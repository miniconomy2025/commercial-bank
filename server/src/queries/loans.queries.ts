import db from "../config/db.config";

export const getLoans = async (loanId:string|undefined): Promise<loans[]> => {
  let query = 'SELECT * FROM loans';
  const parameters = [];

  if (loanId) {
    query += ' WHERE loan_number = $1';
    parameters.push(loanId);
  }

  return db.manyOrNone(query, parameters);
};

export const createLoan = async (
  transaction_number: string,
  to: string,
  interest_rate: number,
  started_at: Date
): Promise<loans> => {
  return db.one(
    'INSERT INTO loans(loan_number, initial_transaction_id, interest_rate, started_at, write_off) VALUES($1, $2, $3, $4, false) RETURNING *',
    [transaction_number, to, interest_rate, started_at]
  );
};

export const createLoanPayment = async (
  loanId: number,
  transaction_number: string,
  amount: number,
  isinterestPayment: boolean = false
): Promise<void> => {
  await db.none(
    'INSERT INTO loan_payments(loan_id, transaction_id, amount, is_interest) VALUES($1, $2, $3, $4)',
    [loanId, transaction_number, amount, isinterestPayment]
  );
};



export type loans  = {
    id: number;
    loan_number: string;
    initial_transaction_id: number;
    interest_rate: number;
    started_at: Date;
    write_off: boolean;
}