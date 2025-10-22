import { ITask } from "pg-promise";
import db from "../config/db.config";
import { getSimTime, SimTime } from "../utils/time";
import { getAccountBalance, getCommercialBankAccountNumber, getCommercialBankAccountRefId } from "./accounts.queries";
import { logger } from '../utils/logger';
import { createTransaction } from "./transactions.queries";
import { sendNotification } from '../utils/notification';
import { LoanDetails, LoanPayment, LoanResult, LoanSummary, RepaymentResult, Result, SimpleResult } from "../types/endpoint.types";


export let maxLoanableAmount = 10000; // Maximum amount that can be loaned out to any particular account
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
export const getTotalOutstandingLoansForAccount = async (accountNumber: string, t?: ITask<{}>): Promise<number> => {
  const result = await (t ?? db).one(`
    SELECT
      GREATEST(0, COALESCE(SUM(init_tx.amount), 0) - COALESCE(SUM(rep_tx.amount), 0)) AS remaining
    FROM accounts a
    JOIN account_refs ar ON ar.account_number = a.account_number AND ar.bank_id = 1
    JOIN transactions init_tx ON init_tx."to" = ar.id
    JOIN loans l ON l.initial_transaction_id = init_tx.id
    LEFT JOIN loan_payments lp_rep ON lp_rep.loan_id = l.id AND lp_rep.is_interest = FALSE
    LEFT JOIN transactions rep_tx ON lp_rep.transaction_id = rep_tx.id
    WHERE a.account_number = $1
  `, [accountNumber]);
  return result?.remaining ? parseFloat(result.remaining) : 0;
};


// Get outstanding repayments for a specific loan number
export const getOutstandingLoanAmount = async (loanNumber: string, t?: ITask<{}>): Promise<number> => {
  const result = await (t ?? db).oneOrNone(`
    SELECT
      GREATEST(0, COALESCE(init_tx.amount, 0) - COALESCE(SUM(rep_tx.amount), 0)) AS outstanding
    FROM loans l
    JOIN transactions init_tx ON init_tx.id = l.initial_transaction_id
    LEFT JOIN loan_payments lp_rep ON lp_rep.loan_id = l.id AND lp_rep.is_interest = FALSE
    LEFT JOIN transactions rep_tx ON rep_tx.id = lp_rep.transaction_id
    WHERE l.loan_number = $1
    GROUP BY init_tx.amount
  `, [loanNumber]);
  return result?.outstanding ? parseFloat(result.outstanding) : 0;
};

type CreateLoanResult = Result<
  LoanResult, 
  { "invalidLoanAmount": {}, "loanTooLarge": { amount_remaining: number }, "bankDepleted": {}, "internalError": {} }
>;
export const createLoan = async (
  accountNumber: string,
  amount: number,
  interestRate: number = loanInterestRate
): Promise<CreateLoanResult> => {
  return db.tx<CreateLoanResult>(async t => {
    // Check amount valid
    if (amount <= 0) return { success: false, error: "invalidLoanAmount" };

    const remaining = Math.max(0, maxLoanableAmount - await getTotalOutstandingLoansForAccount(accountNumber, t));
    if (amount > remaining) return { success: false, error: "loanTooLarge", amount_remaining: remaining };

    // Get commercial-bank account no.
    const bankAccNo = await getCommercialBankAccountNumber(t);
    if (bankAccNo == null) return { success: false, error: "internalError" };

    // Check commercial-bank has sufficient funds
    const bankBalance = await getAccountBalance(bankAccNo, t);
    if (bankBalance == null || bankBalance < amount) {
      return { success: false, error: "bankDepleted" };
    }

    // Insert transaction
    const transaction = await createTransaction(accountNumber, bankAccNo, amount, `Loan disbursement to ${accountNumber}`);

    // Insert loan
    const loanRaw = await t.one(`
      INSERT INTO loans (
        loan_number, initial_transaction_id, interest_rate, started_at, write_off
      ) VALUES (
        generate_unique_loan_number(), $1, $2, $3, false
      ) RETURNING loan_number, initial_transaction_id, interest_rate, started_at, write_off
      `, [ transaction.transaction_id, interestRate, getSimTime() ]
    );
    
    const loan: LoanResult = {
      ...loanRaw,
      interest_rate: parseFloat(loanRaw.interest_rate)
    };

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
  const results = await db.manyOrNone(`
    SELECT
      t.created_at AS timestamp,
      t.amount,
      lp.is_interest
    FROM loan_payments lp
    JOIN transactions t ON lp.transaction_id = t.id
    JOIN loans l ON lp.loan_id = l.id
    WHERE l.loan_number = $1
  `, [loanNumber]);
  
  return results.map(row => ({ ...row, amount: parseFloat(row.amount) }));
}


export const getLoanSummariesForAccount = async (
  accountNumber: string
): Promise<LoanSummary[]> => {
  const results = await db.manyOrNone(`
    SELECT
      l.loan_number,
      t.amount AS initial_amount,
      l.interest_rate,
      l.started_at,
      l.write_off,
      GREATEST(0, COALESCE(t.amount - SUM(rep_tx.amount), t.amount)) AS outstanding_amount
    FROM loans l
    JOIN transactions t ON t.id = l.initial_transaction_id
    JOIN account_refs ar ON t."to" = ar.id
    LEFT JOIN loan_payments lp_rep ON lp_rep.loan_id = l.id AND lp_rep.is_interest = FALSE
    LEFT JOIN transactions rep_tx ON rep_tx.id = lp_rep.transaction_id
    WHERE ar.account_number = $1
    GROUP BY l.loan_number, t.amount, l.interest_rate, l.started_at, l.write_off
    ORDER BY l.started_at DESC
  `, [accountNumber]);
  
  return results.map(row => ({
    ...row,
    initial_amount: parseFloat(row.initial_amount),
    interest_rate: parseFloat(row.interest_rate),
    outstanding_amount: parseFloat(row.outstanding_amount)
  }));
};

// NOTE: Only the account which took out the loan can get loan summary
export const getLoanSummary = async (
  loanNumber: string,
  accountNumber: string
): Promise<LoanSummary | null> => {
  const result = await db.oneOrNone(`
    SELECT
      l.loan_number,
      t.amount AS initial_amount,
      l.interest_rate,
      l.started_at,
      l.write_off,
      GREATEST(0, COALESCE(t.amount - SUM(rep_tx.amount), t.amount)) AS outstanding_amount
    FROM loans l
    JOIN transactions t ON t.id = l.initial_transaction_id
    JOIN account_refs ar ON t."to" = ar.id
    LEFT JOIN loan_payments lp_rep ON lp_rep.loan_id = l.id AND lp_rep.is_interest = FALSE
    LEFT JOIN transactions rep_tx ON rep_tx.id = lp_rep.transaction_id
    WHERE ar.account_number = $2
      AND l.loan_number = $1
    GROUP BY l.loan_number, t.amount, l.interest_rate, l.started_at, l.write_off
  `, [loanNumber, accountNumber]);
  
  return result ? {
    ...result,
    initial_amount: parseFloat(result.initial_amount),
    interest_rate: parseFloat(result.interest_rate),
    outstanding_amount: parseFloat(result.outstanding_amount)
  } : null;
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
type RepayLoanResult = SimpleResult<RepaymentResult, "invalidRepaymentAmount" | "loanNotFound" | "internalError">;
export const repayLoan = async (
  loanNumber: string,
  accountNumber: string,
  amount: number
): Promise<RepayLoanResult> => {
  return db.tx<RepayLoanResult>(async (t) => {

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
      from: accountNumber,
      to: bankAccNo
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

// Charge interest on all outstanding loans
export const chargeInterest = async () => {
  await db.tx(async t => {
    // Get all loans with outstanding balances
    const loansWithBalance = await t.manyOrNone<{
      loan_id: number;
      loan_number: string;
      account_number: string;
      outstanding_amount: string;
      interest_rate: string;
    }>(`
      SELECT
        l.id as loan_id,
        l.loan_number,
        ar.account_number,
        init_tx.amount - COALESCE(SUM(rep_tx.amount), 0) AS outstanding_amount,
        l.interest_rate
      FROM loans l
      JOIN transactions init_tx ON init_tx.id = l.initial_transaction_id
      JOIN account_refs ar ON init_tx."to" = ar.id
      LEFT JOIN loan_payments lp_rep ON lp_rep.loan_id = l.id AND lp_rep.is_interest = FALSE
      LEFT JOIN transactions rep_tx ON rep_tx.id = lp_rep.transaction_id
      WHERE l.write_off = FALSE
      GROUP BY l.id, l.loan_number, ar.account_number, init_tx.amount, l.interest_rate
      HAVING init_tx.amount - COALESCE(SUM(rep_tx.amount), 0) > 0
    `);

    const bankAccNo = await getCommercialBankAccountNumber(t);
    if (!bankAccNo) return;

    // Charge interest on each loan
    for (const loan of loansWithBalance) {
      const outstandingAmount = parseFloat(loan.outstanding_amount);
      const interestRate = parseFloat(loan.interest_rate);
      const interestCharge = outstandingAmount * interestRate;

      if (interestCharge > 0) {
        // Check if borrower has sufficient funds for interest payment
        const borrowerBalance = await getAccountBalance(loan.account_number, t);
        
        if (borrowerBalance != null && borrowerBalance >= interestCharge) {
          try {
          // Create interest charge transaction
          const transaction = await createTransaction(bankAccNo, loan.account_number, interestCharge, `Interest charge on loan ${loan.loan_number}`);

          // Link interest charge to the loan
          await t.none(`
            INSERT INTO loan_payments (loan_id, transaction_id, is_interest)
            VALUES ($1, $2, true)
          `, [loan.loan_id, transaction.transaction_id]);

          // Send notification
          await sendNotification(loan.account_number, {
            transaction_number: transaction.transaction_number,
            status: transaction.status || 'success',
            amount: interestCharge,
            timestamp: Number(getSimTime()),
            description: `Interest charge on loan ${loan.loan_number}`,
            from: loan.account_number,
            to: bankAccNo
          });
          } catch (error: any) {
            // If transaction fails due to insufficient funds, write off the loan
            if (error.code === 'check_violation' || error.message?.includes('Insufficient funds')) {
              await t.none(`
                UPDATE loans SET write_off = TRUE WHERE id = $1
              `, [loan.loan_id]);
              
              logger.info(`Loan ${loan.loan_number} written off due to insufficient funds for interest payment: ${error.message}`);
            } else {
              throw error; // Re-throw other errors
            }
          }
        } else {
          // Insufficient funds - write off the loan
          await t.none(`
            UPDATE loans SET write_off = TRUE WHERE id = $1
          `, [loan.loan_id]);
          
          logger.info(`Loan ${loan.loan_number} written off due to insufficient funds for interest payment`);
        }
      }
    }
  });
};

// 'Smart' debit order system for repayments on loans:
// - Calculate instalment as percentage of initial loan amounts (not outstanding)
// - Only proceed if instalment amount is within account balance threshold
// - Pay loans in order of highest interest rate first
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
      const loansRaw = await t.manyOrNone<{
        loan_number: string;
        initial_amount: string;
        outstanding_amount: string;
        interest_rate: string;
      }>(`
        SELECT
          l.loan_number,
          init_tx.amount AS initial_amount,
          GREATEST(0, init_tx.amount - COALESCE(SUM(rep_tx.amount), 0)) AS outstanding_amount,
          l.interest_rate
        FROM loans l
        JOIN transactions init_tx ON init_tx.id = l.initial_transaction_id
        JOIN account_refs ar ON init_tx."to" = ar.id
        LEFT JOIN loan_payments lp_rep ON lp_rep.loan_id = l.id AND lp_rep.is_interest = FALSE
        LEFT JOIN transactions rep_tx ON rep_tx.id = lp_rep.transaction_id
        WHERE ar.account_number = $1
        GROUP BY l.loan_number, init_tx.amount, l.interest_rate
        HAVING GREATEST(0, init_tx.amount - COALESCE(SUM(rep_tx.amount), 0)) > 0
      `, [account_number]);
      
      const loans = loansRaw.map(loan => ({
        loan_number: loan.loan_number,
        initial_amount: parseFloat(loan.initial_amount),
        outstanding_amount: parseFloat(loan.outstanding_amount),
        interest_rate: parseFloat(loan.interest_rate)
      }));

      if (loans.length === 0) continue; // No loans on this account

      // Calculate instalment total based on initial amounts (as per comment)
      const totalInitialAmount = loans.reduce((sum, loan) => sum + loan.initial_amount, 0);
      let instalTotal = totalInitialAmount * instalmentPercentage;

      // If instalment amount exceeds threshold, skip this round
      if (instalTotal > threshold) continue;

      // Sort loans by highest interest rate, then highest outstanding amount
      const sortedLoans = loans.sort((a, b) =>
        b.interest_rate - a.interest_rate || b.outstanding_amount - a.outstanding_amount
      );

      // Pay off as much as possible of each loan, whittling down instalTotal
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