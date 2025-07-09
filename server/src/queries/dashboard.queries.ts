import db from "../config/db.config";


export const getAllExistingTransactions = async (account: number | undefined): Promise<Transaction[]> => {
  const baseQuery = `
    SELECT 
      ts.name as status,
      t.amount,
      t.description,
      from_bank.name as from,
      to_bank.name as to
    FROM transactions t
    JOIN transaction_statuses ts ON t.status_id = ts.id
    JOIN account_refs from_ref ON t."from" = from_ref.id
    JOIN account_refs to_ref ON t."to" = to_ref.id
    JOIN banks from_bank ON from_ref.bank_id = from_bank.id
    JOIN banks to_bank ON to_ref.bank_id = to_bank.id
  `;

  if (account) {
    return await db.many(`
      ${baseQuery}
      WHERE t."from" = $1 OR t."to" = $1
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
    WHERE a.closed_at IS NULL
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

export type Transaction = {
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