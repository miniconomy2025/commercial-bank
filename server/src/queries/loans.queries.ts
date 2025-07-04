import { ITask } from "pg-promise";
import db from "../config/db.config";
import { getSimTime, SimTime } from "../utils/time";
import { getCommercialBankAccountNumber, getCommercialBankAccountRefId } from "./accounts.queries";
import { createTransaction } from "./transactions.queries";

export const getLoanIdFromNumber = async (loanNumber: string, t?: ITask<{}>): Promise<number | null> =>
  (await (t ?? db).oneOrNone<{ id: number; }>(`SELECT id FROM loans WHERE loan_number = $1`, [loanNumber]))?.id ?? null;

// Get the total amount of money that is still outstanding across all loans for the account
export const getTotalOutstandingLoansForAccount = async (accountNumber: string, t?: ITask<{}>): Promise<number> =>
  (await (t ?? db).one(`
    SELECT
      COALESCE(SUM(init_tx.amount), 0) - COALESCE(SUM(rep_tx.amount), 0) AS remaining
    FROM accounts a
    JOIN account_refs ar ON ar.account_number = a.account_number AND ar.bank_id = 1
    JOIN transactions init_tx ON init_tx."to" = ar.id
    JOIN loans l ON l.initial_transaction_id = init_tx.id
    LEFT JOIN loan_payments lp ON lp.loan_id = l.id AND lp.is_interest = FALSE
    LEFT JOIN transactions rep_tx ON lp.transaction_id = rep_tx.id
    WHERE a.account_number = $1
  `, [accountNumber]))?.remaining ?? 0;

// Get outstanding repayments for a specific loan number
export const getOutstandingLoanAmount = async (loanNumber: string, t?: ITask<{}>): Promise<number> =>
  (await (t ?? db).one(`
    SELECT
      COALESCE(init_tx.amount, 0) - COALESCE(SUM(rep_tx.amount), 0) AS outstanding
    FROM loans l
    JOIN transactions init_tx ON init_tx.id = l.initial_transaction_id
    LEFT JOIN loan_payments lp ON lp.loan_id = l.id AND lp.is_interest = FALSE
    LEFT JOIN transactions rep_tx ON rep_tx.id = lp.transaction_id
    WHERE l.loan_number = $1
    GROUP BY init_tx.amount
  `, [loanNumber]))?.outstanding ?? 0;



// TODO: Move to config
export const MAX_LOANABLE_AMOUNT = 10000; // Max. amount an account can borrow in total across all loans
export const LOAN_INTEREST_RATE = 0.01;   // Interest charged each day on the outstanding loan amount

export const createLoan = async (
  accountNumber: string,
  amount: number,
  interestRate: number = LOAN_INTEREST_RATE
): Promise<Result<LoanResult>> => {
  return db.tx(async t => {
    // Check amount valid
    if (amount <= 0) return { success: false, error: "invalid_loan_amount" };

    const remaining = Math.max(0, MAX_LOANABLE_AMOUNT - await getTotalOutstandingLoansForAccount(accountNumber, t));
    if (amount > remaining) return { success: false, error: "loan_too_large", amount_remaining: remaining };


    // Get commercial-bank account no.
    const bankAccNo = await getCommercialBankAccountNumber(t);
    if (bankAccNo == null) { throw Error("commercial-bank account_ref not found"); }


    // Insert transaction
    const transaction = await createTransaction(accountNumber, 'commercial-bank', bankAccNo, amount, `Loan disbursement to ${accountNumber}`, getSimTime());

    // Insert loan
    const loan = await t.one<LoanResult>(
      `
      INSERT INTO loans (
        loan_number, initial_transaction_id, interest_rate, started_at, write_off
      ) VALUES (
        generate_unique_loan_number(), $1, $2, now(), false
      ) RETURNING loan_number, initial_transaction_id, interest_rate, started_at, write_off
      `,
      [ transaction.transaction_id, interestRate ]
    );

    return { success: true, ...loan };
  });
}


export const getLoanPaymentsByNumber = async (loanNumber: string): Promise<LoanPayment[]> => {
  return db.manyOrNone(`
    SELECT
      t.created_at AS timestamp,
      t.amount,
      lp.is_interest
    FROM loan_payments lp
    JOIN transactions t ON lp.transaction_id = t.id
    JOIN loans l ON lp.loan_id = l.id
    WHERE l.loan_number = $1
    ORDER BY t.created_at;
  `, [loanNumber]);
}


export const getLoanSummariesForAccount = async (
  accountNumber: string
): Promise<LoanSummary[]> => {
  return db.manyOrNone<LoanSummary>(`
    SELECT
      l.loan_number,
      t.amount AS initial_amount,
      l.interest_rate,
      l.started_at,
      l.write_off,
      COALESCE(t.amount - SUM(p_tx.amount), t.amount) AS outstanding_amount
    FROM loans l
    JOIN transactions t ON t.id = l.initial_transaction_id
    JOIN account_refs ar ON t."to" = ar.id
    LEFT JOIN loan_payments lp ON lp.loan_id = l.id
    LEFT JOIN transactions p_tx ON p_tx.id = lp.transaction_id
    WHERE ar.account_number = $1
    GROUP BY l.loan_number, t.amount, l.interest_rate, l.started_at, l.write_off
    ORDER BY l.started_at DESC
  `, [accountNumber]);
};

// NOTE: Only the account which took out the loan can get loan summary
export const getLoanSummary = async (
  loanNumber: string,
  accountNumber: string
): Promise<LoanSummary | null> => {
  return db.oneOrNone<LoanSummary>(`
    SELECT
      l.loan_number,
      t.amount AS initial_amount,
      l.interest_rate,
      l.started_at,
      l.write_off,
      COALESCE(t.amount - SUM(p_tx.amount), t.amount) AS outstanding_amount
    FROM loans l
    JOIN transactions t ON t.id = l.initial_transaction_id
    JOIN account_refs ar ON t."to" = ar.id
    LEFT JOIN loan_payments lp ON lp.loan_id = l.id
    LEFT JOIN transactions p_tx ON p_tx.id = lp.transaction_id
    WHERE ar.account_number = $2
      AND l.loan_number = $1
    GROUP BY l.loan_number, t.amount, l.interest_rate, l.started_at, l.write_off
  `, [loanNumber, accountNumber]);
};


// NOTE: Only the account which took out the loan can get loan details
export const getLoanDetails = async (
  loanNumber: string,
  accountNumber: string
): Promise<Result<LoanDetails>> => {

  const summary = await getLoanSummary(loanNumber, accountNumber);
  if (summary == null) return { success: false, error: "loan_not_found" };

  const payments = await getLoanPaymentsByNumber(loanNumber);

  return { success: true, ...summary, payments };
};


// NOTE: Any account can contribute to the repayment of a loan on any other account
export const repayLoan = async (
  loanNumber: string,
  accountNumber: string,
  amount: number
): Promise<Result<RepaymentResult>> => {
  return db.tx<Result<RepaymentResult>>(async (t) => {

    // Validate amount
    if (amount <= 0) return { success: false, error: "invalid_repayment_amount" };

    // Get loan ID
    const loanId = await getLoanIdFromNumber(loanNumber, t);
    if (loanId == null) return { success: false, error: "loan_not_found" };

    // Get commercial-bank account no.
    const bankAccNo = await getCommercialBankAccountNumber(t);
    if (bankAccNo == null) { throw Error("commercial-bank account_ref not found"); }


    // Get outstanding amount to pay
    const outstanding = await getOutstandingLoanAmount(loanNumber, t);
    const repayment = Math.min(amount, outstanding); // Prevent overpayment


    // Create repayment transaction
    const transaction = await createTransaction(bankAccNo, 'commercial-bank', accountNumber, repayment, `Repayment of loan ${loanNumber}`, getSimTime());

    // Link repayment to the loan
    await t.none(`
      INSERT INTO loan_payments (loan_id, transaction_id, is_interest)
      VALUES ($1, $2, false)
      `,
      [loanId, transaction.transaction_id]
    );

    return { success: true, paid: repayment };
  });
};

export type LoanSummary = {
  loan_number: string;
  initial_amount: number;
  interest_rate: number;
  started_at: SimTime;
  write_off: boolean;
  outstanding_amount: number;
};

export type LoanPayment = {
  timestamp: SimTime;
  amount: number;
  is_interest: boolean;
};

export type LoanDetails = LoanSummary & { payments: LoanPayment[] };

type Result<T extends object, E extends object = object> = (
  ({ success: true } & T) |
  ({ success: false; error: string; } & E)
);

interface LoanResult {
  loan_number: string;
  initial_transaction_id: number;
  interest_rate: number;
  started_at: string;
  write_off: boolean;
}

type RepaymentResult = {
  paid: number;
};