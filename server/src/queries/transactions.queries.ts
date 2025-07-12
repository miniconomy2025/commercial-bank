import db from "../config/db.config";
import { CreateTransactionResult, Post_Transaction_Res, Transaction } from "../types/endpoint.types";
import { getSimTime } from "../utils/time";

export const getAllTransactions = async (
  fromAccountNumber: string,
  toAccountNumber: string,
  onlySuccessful: boolean = false
): Promise<Transaction[]> => {
  const parameters: (string | number)[] = [fromAccountNumber, toAccountNumber];
  let query = `
    SELECT
      t.transaction_number,
      from_ref.account_number AS "from",
      to_ref.account_number AS "to",
      t.amount,
      t.description,
      s.name AS status,
      t.created_at AS timestamp
    FROM transactions t
    JOIN account_refs from_ref ON t."from" = from_ref.id
    JOIN account_refs to_ref ON t."to" = to_ref.id
    JOIN transaction_statuses s ON t.status_id = s.id
    WHERE (from_ref.account_number = $1 OR to_ref.account_number = $1)
      AND (from_ref.account_number = $2 OR to_ref.account_number = $2)
  `;

  if (onlySuccessful) {
    query += ' AND t.status_id = $3';
    parameters.push(1); // Assuming 1 = success
  }

  return db.manyOrNone(query, parameters);
};


export const getTransactionStatusId = async (statusName: string): Promise<number | null> =>
  (await db.oneOrNone('SELECT id FROM transaction_statuses WHERE name = $1', [statusName]))?.id ?? null;


// Blindly create a transaction
// Validation must be done before calling this function
export const createTransaction = async (
    recipient_account_number: string,
    sender_account_number: string,
    amount: number,
    description: string,
    sender_bank_name: string = 'commercial-bank',
    recipient_bank_name: string = 'commercial-bank',
    transactionNumber?: string
  )
: Promise<CreateTransactionResult> => {
  return db.one(
  `WITH
      inserted AS (
        INSERT INTO transactions (transaction_number, "from", "to", amount, description, status_id, created_at)
        VALUES (
          COALESCE($8, generate_unique_transaction_number()),
          get_or_create_account_ref_id($1, $2),
          get_or_create_account_ref_id($3, $4),
          $5, $6, 1, $7
        )
        RETURNING id AS transaction_id, transaction_number, status_id
    )
  SELECT
      i.transaction_id,
      i.transaction_number,
      s.name AS status
  FROM inserted i
  JOIN transaction_statuses s ON s.id = i.status_id;
  `,
    [sender_account_number, sender_bank_name, recipient_account_number, recipient_bank_name, amount, description, getSimTime(), transactionNumber ?? null]
  );
}

export const getTransactionById = async (id: string): Promise<Transaction | null> => {
  return db.oneOrNone(`SELECT
    t.transaction_number,
    from_ref.account_number AS "from",
    to_ref.account_number AS "to",
    t.amount,
    t.description,
    s.name AS status,
    t.created_at AS timestamp
  FROM transactions t
  JOIN account_refs from_ref ON t."from" = from_ref.id
  JOIN account_refs to_ref ON t."to" = to_ref.id
  JOIN transaction_statuses s ON t.status_id = s.id
  WHERE t.transaction_number =  $1`, [id]);
}