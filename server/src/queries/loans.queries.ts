import { ITask } from "pg-promise";
import db from "../config/db.config";
import { getSimTime, SimTime } from "../utils/time";
import { getAccountBalance, getCommercialBankAccountNumber, getCommercialBankAccountRefId } from "./accounts.queries";
import { createTransaction } from "./transactions.queries";
import { sendNotification } from '../utils/notification';
import { LoanDetails, LoanPayment, LoanResult, LoanSummary, RepaymentResult, Result, SimpleResult } from "../types/endpoint.types";


export let maxLoanableAmount = 1000000; // Maximum amount that can be loaned out across all accounts
export let loanInterestRate = 0.01;     // Interest charged each day on the outstanding loan amount

export const setLoanInterestRate = (rate: number) => {
  loanInterestRate = rate;
};

export const setLoanCap = (amount: number) => {
  maxLoanableAmount = amount;
}


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

export const createLoan = async (
  accountNumber: string,
  amount: number,
  interestRate: number = loanInterestRate
): Promise<Result<LoanResult, { "invalidLoanAmount": {}, "loanTooLarge": { amount_remaining: number }, "internalError": {} }>> => {
  return db.tx(async t => {
    // Check amount valid
    if (amount <= 0) return { success: false, error: "invalidLoanAmount" };

    const remaining = Math.max(0, maxLoanableAmount - await getTotalOutstandingLoansForAccount(accountNumber, t));
    if (amount > remaining) return { success: false, error: "loanTooLarge", amount_remaining: remaining };

    // Get commercial-bank account no.
    const bankAccNo = await getCommercialBankAccountNumber(t);
    if (bankAccNo == null) return { success: false, error: "internalError" }

    // Insert transaction
    const transaction = await createTransaction(accountNumber, bankAccNo, amount, `Loan disbursement to ${accountNumber}`);

    // Insert loan
    const loan = await t.one<LoanResult>(`
      INSERT INTO loans (
        loan_number, initial_transaction_id, interest_rate, started_at, write_off
      ) VALUES (
        generate_unique_loan_number(), $1, $2, $3, false
      ) RETURNING loan_number, initial_transaction_id, interest_rate, started_at, write_off
      `, [ transaction.transaction_id, interestRate, getSimTime() ]
    );

    // Send notification to recipient
    await sendNotification(accountNumber, {
      transaction_number: transaction.transaction_number,
      status: transaction.status || 'success',
      amount: amount,
      timestamp: Number(getSimTime()),
      description: `Loan disbursement to ${accountNumber}`,
      from: bankAccNo,
      to: accountNumber
    });

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
): Promise<SimpleResult<LoanDetails, "loanNotFound">> => {

  const summary = await getLoanSummary(loanNumber, accountNumber);
  if (summary == null) return { success: false, error: "loanNotFound" };

  const payments = await getLoanPaymentsByNumber(loanNumber);

  return { success: true, ...summary, payments };
};


// NOTE: Any account can contribute to the repayment of a loan on any other account
export const repayLoan = async (
  loanNumber: string,
  accountNumber: string,
  amount: number
): Promise<SimpleResult<RepaymentResult, "invalidRepaymentAmount" | "loanNotFound" | "internalError">> => {
  return db.tx(async (t) => {

    // Validate amount
    if (amount <= 0) return { success: false, error: "invalidRepaymentAmount" };

    // Get loan ID
    const loanId = await getLoanIdFromNumber(loanNumber, t);
    if (loanId == null) return { success: false, error: "loanNotFound" };

    // Get commercial-bank account no.
    const bankAccNo = await getCommercialBankAccountNumber(t);
    if (bankAccNo == null) return { success: false, error: "internalError" };


    // Get outstanding amount to pay
    const outstanding = await getOutstandingLoanAmount(loanNumber, t);
    const repayment = Math.min(amount, outstanding); // Prevent overpayment


    // Create repayment transaction
    const transaction = await createTransaction(bankAccNo, accountNumber, repayment, `Repayment of loan ${loanNumber}`);

    // Send notification to recipient
    await sendNotification(accountNumber, {
      transaction_number: transaction.transaction_number,
      status: transaction.status || 'success',
      amount: repayment,
      timestamp: Number(getSimTime()),
      description: `Repayment of loan ${loanNumber}`,
      from: bankAccNo,
      to: accountNumber
    });

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

// 'Smart' debit order system for repayments on loans:
// - A list of all outstanding loans, their outstanding amounts, and their initial amounts is aggregated
// - (The total outstanding amount should be calculated from this list, and multiplied by `instalmentPercentage`) = instalTotal
// - If (balance * balancePercentageThreshold = threshold) <= instalTotal: insufficient funds => fail to pay instalment this time 'round
// - Otherwise: Loop through all outstanding loans, paying off the ones with the largest interest rate & largest outstanding amount first

// Loop through all active loans across all accounts, and attempt the payment of an instalment for each of them
export const attemptInstalments = async (
  instalmentPercentage: number = 0.10,          // Instalment amount is calculated as 10% of the initial investment
  balancePercentageThreshold: number = 0.05,    // Instalment will only be paid if it's < 5% of account balance
) => {
  await db.tx(async t => {
    // Get accounts with non-zero outstanding loan balance & not written off
    const accountsWithLoans = await t.manyOrNone<{ account_number: string }>(`
      SELECT
        a.account_number
      FROM accounts a
      JOIN account_refs ar ON ar.account_number = a.account_number AND ar.bank_id = 1
      JOIN transactions init_tx ON init_tx."to" = ar.id
      JOIN loans l ON l.initial_transaction_id = init_tx.id
      LEFT JOIN loan_payments lp ON lp.loan_id = l.id AND lp.is_interest = FALSE
      LEFT JOIN transactions rep_tx ON lp.transaction_id = rep_tx.id
      WHERE l.write_off = FALSE
      GROUP BY a.account_number
      HAVING COALESCE(SUM(init_tx.amount), 0) - COALESCE(SUM(rep_tx.amount), 0) > 0
    `);

    // Loop through all accounts to determine credibility for instalment
    for (const { account_number } of accountsWithLoans) {

      // Get account balance
      const balance = await getAccountBalance(account_number);
      if (balance == null) continue; // Account does not exist

      const threshold = balance * balancePercentageThreshold;

      // Get all outstanding loans for this account, with initial + remaining + interest_rate
      const loans = await t.manyOrNone<{
        loan_number: string;
        initial_amount: number;
        outstanding_amount: number;
        interest_rate: number;
      }>(`
        SELECT
          l.loan_number,
          init_tx.amount AS initial_amount,
          init_tx.amount - COALESCE(SUM(rep_tx.amount), 0) AS outstanding_amount,
          l.interest_rate
        FROM loans l
        JOIN transactions init_tx ON init_tx.id = l.initial_transaction_id
        JOIN account_refs ar ON init_tx."to" = ar.id
        LEFT JOIN loan_payments lp ON lp.loan_id = l.id AND lp.is_interest = FALSE
        LEFT JOIN transactions rep_tx ON rep_tx.id = lp.transaction_id
        WHERE ar.account_number = $1
        GROUP BY l.loan_number, init_tx.amount, l.interest_rate
        HAVING init_tx.amount - COALESCE(SUM(rep_tx.amount), 0) > 0
      `, [account_number]);

      if (loans.length === 0) continue; // No loans on this account

      // Calculate total outstanding amount for all loans and instalment total
      const totalOutstanding = loans.reduce((sum, loan) => sum + loan.outstanding_amount, 0);
      let instalTotal = totalOutstanding * instalmentPercentage;

      // If threshold is too low, skip this round
      if (instalTotal > threshold) continue;

      // Sort loans by highest interest rate, then highest outstanding amount
      const sortedLoans = loans.sort((a, b) =>
        b.interest_rate - a.interest_rate || b.outstanding_amount - a.outstanding_amount
      );

      // Pay off as much as possible of each loan, wittling down instalTotal
      for (const loan of sortedLoans) {
        if (instalTotal <= 0) break;
        const payAmount = Math.min(loan.outstanding_amount, instalTotal);
        if (payAmount > 0) {
          await repayLoan(loan.loan_number, account_number, payAmount);
          instalTotal -= payAmount;
        }
      }
    }
  });
};