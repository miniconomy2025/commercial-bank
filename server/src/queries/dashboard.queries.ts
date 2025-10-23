import db from "../config/db.config";
import { Transaction } from "../types/endpoint.types";
import { SimTime } from "../utils/time";


export const getAllExistingTransactions = async (account: string | undefined): Promise<Transaction[]> => {
  const baseQuery = `
    SELECT 
      t.transaction_number as transaction_number,
      from_acc.team_id AS from,
      to_acc.team_id AS to,
      t.amount,
      t.description,
      ts.name AS status,
      t.created_at as timestamp
    FROM transactions t
    JOIN transaction_statuses ts ON t.status_id = ts.id
    JOIN account_refs from_ref ON t."from" = from_ref.id
    JOIN accounts from_acc ON from_ref.account_number = from_acc.account_number
    JOIN account_refs to_ref ON t."to" = to_ref.id
    JOIN accounts to_acc ON to_ref.account_number = to_acc.account_number
  `;

  const results = account 
    ? await db.manyOrNone(`${baseQuery} WHERE from_acc.team_id = $1 OR to_acc.team_id = $1`, [account])
    : await db.manyOrNone(baseQuery);
  
  return results.map(row => ({ ...row, amount: parseFloat(row.amount) }));
};

export const getAllExistingAccounts = async (): Promise<AccountInfo[]> => {
  const results = await db.manyOrNone(`
    SELECT 
      a.id,
      a.account_number as account_number,
      a.team_id as name,
      COALESCE(account_totals.balance, 0) as balance,
      COALESCE(account_totals.income, 0) as income,
      COALESCE(account_totals.expenses, 0) as expenses
    FROM accounts a
    LEFT JOIN (
      SELECT 
        ar.account_number,
        COALESCE(incoming.total, 0) - COALESCE(outgoing.total, 0) as balance,
        COALESCE(incoming.total, 0) as income,
        COALESCE(outgoing.total, 0) as expenses
      FROM account_refs ar
      LEFT JOIN (
        SELECT 
          t."to" as account_ref_id,
          SUM(t.amount) as total
        FROM transactions t
        GROUP BY t."to"
      ) incoming ON ar.id = incoming.account_ref_id
      LEFT JOIN (
        SELECT 
          t."from" as account_ref_id,
          SUM(t.amount) as total
        FROM transactions t
        GROUP BY t."from"
      ) outgoing ON ar.id = outgoing.account_ref_id
    ) account_totals ON a.account_number = account_totals.account_number
    WHERE a.closed_at IS NULL
  `);
  
  return results.map(row => ({
    ...row,
    balance: parseFloat(row.balance),
    income: parseFloat(row.income),
    expenses: parseFloat(row.expenses)
  }));
};

export const getAllAccountExpenses = async (accountId: number): Promise<Expense[]> => {
  const results = await db.manyOrNone(`
    SELECT 
      t.description,
      t.amount
    FROM transactions t
    JOIN account_refs ar ON t."from" = ar.id
    JOIN accounts a ON ar.account_number = a.account_number
    WHERE a.id = $1
  `, [accountId]);
  
  return results.map(row => ({ ...row, amount: parseFloat(row.amount) }));
};

interface LoanBalance {
  loan_balance: number;
}

export const getLoanBalances = async (accountId: number): Promise<LoanBalance> => {
  const result = await db.oneOrNone(`
    SELECT 
      COALESCE(SUM(initial_t.amount - COALESCE(payments.total_payments, 0)), 0) as loan_balance
    FROM loans l
    JOIN transactions initial_t ON l.initial_transaction_id = initial_t.id
    JOIN account_refs ar ON initial_t."to" = ar.id
    JOIN accounts a ON ar.account_number = a.account_number
    LEFT JOIN (
      SELECT 
        lp.loan_id,
        SUM(payment_t.amount) as total_payments
      FROM loan_payments lp
      JOIN transactions payment_t ON lp.transaction_id = payment_t.id
      GROUP BY lp.loan_id
    ) payments ON l.id = payments.loan_id
    WHERE a.id = $1 AND l.write_off = false
  `, [accountId]);
  return result ? { loan_balance: parseFloat(result.loan_balance) } : { loan_balance: 0 };
};

export type loan = {
  status: string;
  amount: number;
  description: string;
  to: string;
};

export type AccountInfo = {
  id: number;
  account_number: string;
  name: string;
  balance: number;
  income: number;
  expenses: number;
};

export type Expense = {
  description: string;
  amount:number;
}