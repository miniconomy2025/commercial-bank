import db from "../config/db.config";

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


export const createTransaction = async (
    recipient_account_number: string, 
    sender_account_number: string, 
    amount:number,
    description: string,
    timestamp: Date
  )
: Promise<TransactionResponse> => {
  return db.one(
  `WITH
      from_ref AS (
        SELECT id FROM account_refs WHERE account_number = $1
      ),
      to_ref AS (
        SELECT id FROM account_refs WHERE account_number = $2
      ),
      inserted AS (
        INSERT INTO transactions (transaction_number, "from", "to", amount, description, status_id, created_at)
        VALUES (
          generate_unique_transaction_number(),
          (SELECT id FROM from_ref),
          (SELECT id FROM to_ref),
          $3, $4, 1, $5
        )
        RETURNING id, transaction_number, status_id
      )
    SELECT 
      i.transaction_number,
      s.name AS status_string
    FROM inserted i
    JOIN transaction_statuses s ON s.id = i.status_id;
  `,
    [sender_account_number,recipient_account_number, amount, description, timestamp]
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

export type Transaction = {
  transaction_number: string;
  from: string;
  to: string;
  amount: number;
  description: string;
  status: string;
  date: Date
};
