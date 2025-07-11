import db from "../config/db.config";
import { getSimTime, SimTime } from "../utils/time";

export const getAllTransactions = async (
  fromAccountNumber: string,
  toAccountNumber: string,
  onlySuccessful: boolean = false
): Promise<Transaction[]> => {
  const fromRef = await db.oneOrNone<{ id: number }>(
    'SELECT id FROM account_refs WHERE account_number = $1',
    [fromAccountNumber]
  );

  const toRef = await db.oneOrNone<{ id: number }>(
    'SELECT id FROM account_refs WHERE account_number = $1',
    [toAccountNumber]
  );


  const parameters: (string | number)[] = [fromRef!.id, toRef!.id];
  let query = 'SELECT * FROM transactions WHERE "from" = $1 AND "to" = $2';

  if (onlySuccessful) {
    query += ' AND status_id = $3';
    parameters.push(1);
  }

  return db.manyOrNone(query, parameters);
};


export const getTransactionStatusId = async (statusName: string): Promise<number | null> =>
  (await db.oneOrNone('SELECT id FROM transaction_statuses WHERE name = $1', [statusName]))?.id ?? null;


// TODO: Validate amount > 0
export const createTransaction = async (
  recipient_account_number: string,
  sender_account_number: string,
  amount: number,
  description: string,
  sender_bank_name: string = 'commercial-bank',
  recipient_bank_name: string = 'commercial-bank',
  transactionNumber?: string
): Promise<CreateTransactionResult> => {  
  const statusId = await validateTransaction(sender_account_number, sender_bank_name, amount);// 1 for success, 2 for failed
  
  return db.one(
    `WITH
      inserted AS (
        INSERT INTO transactions (transaction_number, "from", "to", amount, description, status_id, created_at)
        VALUES (
          COALESCE($8, generate_unique_transaction_number()),
          get_or_create_account_ref_id($1, $2),
          get_or_create_account_ref_id($3, $4),
          $5, $6, $9, $7
        )
        RETURNING id AS transaction_id, transaction_number, status_id
    )
    SELECT 
        i.transaction_id,
        i.transaction_number,
        s.name AS status_string
    FROM inserted i
    JOIN transaction_statuses s ON s.id = i.status_id;
    `,
    [sender_account_number, sender_bank_name, recipient_account_number, recipient_bank_name, amount, description, getSimTime(), transactionNumber ?? null, statusId]
  );
};

const validateTransaction = async (
  sender_account_number: string,
  sender_bank_name: string,
  amount: number
): Promise<number> => {
  try {
    const account = await db.oneOrNone(
      `SELECT balance FROM accounts WHERE account_number = $1 AND bank_name = $2`,
      [sender_account_number, sender_bank_name]
    );
    
    if (!account ) {
      return 3; 
    }
    
    if (account.balance < amount) {
      return 2;
    }
    
    return 1;
  } catch (error) {
    return 3;
  }
};

export const getTransactionById = async (id: string): Promise<Transaction | null> => {
  return db.oneOrNone(`SELECT
    t.transaction_number,
    t.amount,
    t.description,
    t.status_id,
    t.created_at as date,
    from_ref.account_number AS "from",
    to_ref.account_number AS "to"
  FROM transactions t
  JOIN account_refs from_ref ON t."from" = from_ref.id
  JOIN account_refs to_ref ON t."to" = to_ref.id
  WHERE t.transaction_number =  $1`, [id]);
}

export type TransactionResponse = {
  status: string;
  transaction_number: string;
};

export type CreateTransactionResult = TransactionResponse & { transaction_id: number; };

export type Transaction = {
  transaction_number: string;
  from: string;
  to: string;
  amount: number;
  description: string;
  status: string;
  date: SimTime
};
