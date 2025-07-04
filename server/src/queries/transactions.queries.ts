import db from "../config/db.config";
import { SimTime } from "../utils/time";

export const getAllTransactions = async (
  from: string,
  to: string,
  onlySuccessful: boolean = false
): Promise<Transaction[]> => {
  const parameters:(string | number)[] = [from, to];
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
    recipient_bank_name: string, 
    sender_account_number: string, 
    amount:number,
    description: string,
    timestamp: number
  )
: Promise<CreateTransactionResult> => {
  return db.one(
  `WITH
      from_ref AS get_or_create_account_ref_id($1, 'commercial-bank'),
      to_ref AS get_or_create_account_ref_id($2, $3),
      inserted AS (
        INSERT INTO transactions (transaction_number, "from", "to", amount, description, status_id, created_at)
        VALUES (
          generate_unique_transaction_number(),
          (SELECT id FROM from_ref),
          (SELECT id FROM to_ref),
          $4, $5, 1, $6
        )
        RETURNING id AS transaction_id, transaction_number, status_id
      )
    SELECT 
      i.transaction_number,
      s.name AS status_string
    FROM inserted i
    JOIN transaction_statuses s ON s.id = i.status_id;
  `,
    [sender_account_number, recipient_account_number, recipient_bank_name, amount, description, timestamp]
  );
}

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
