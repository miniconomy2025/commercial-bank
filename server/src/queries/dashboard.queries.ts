import db from "../config/db.config";


export const getAllExistingTransactions = async (account: string | undefined): Promise<Transaction[]> => {
  const baseQuery = `
    SELECT 
      t.transaction_number as transaction_number,
      ts.name AS status,
      t.amount,
      t.description,
      from_acc.team_id AS from,
      to_acc.team_id AS to
    FROM transactions t
    JOIN transaction_statuses ts ON t.status_id = ts.id
    JOIN account_refs from_ref ON t."from" = from_ref.id
    JOIN accounts from_acc ON from_ref.account_number = from_acc.account_number
    JOIN account_refs to_ref ON t."to" = to_ref.id
    JOIN accounts to_acc ON to_ref.account_number = to_acc.account_number
  `;

  if (account) {
    return await db.many(`
      ${baseQuery}
      WHERE from_acc.team_id = $1 OR to_acc.team_id = $1
    `, [account]);
  } else {
    return await db.many(baseQuery);
  }
};

export const getAllExistingAccounts = async (): Promise<Accounts[]> => {
  return await db.many(`
    SELECT 
      a.id,
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
    WHERE a.closed_at IS NULL AND a.team_id NOT LIKE 'commercial-bank'
  `);
};

export const getAllAccountExpenses = async (accountId: number): Promise<Expenses[]> => {
  return await db.many(`
    SELECT 
      t.description,
      t.amount
    FROM transactions t
    JOIN account_refs ar ON t."from" = ar.id
    JOIN accounts a ON ar.account_number = a.account_number
    WHERE a.id = $1
  `, [accountId]);
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
  return result ?? { total_outstanding_balance: 0 };
};

export type Transaction = {
    transaction_number:string;
    status:string;
    amount:number;
    description:string;
    from:string;
    to:string;
};

export type loan = {
    status:string;
    amount:number;
    description:string;
    to:string;
};

export type Accounts = {
    id:number;
    name:string;
    balance: number;
    income:number;
    expenses:number;
};

export type Expenses= {
    description: string;
    amount:number;
}