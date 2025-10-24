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
    LEFT JOIN transactions rep_tx ON lp_rep.transaction_id = rep_tx.id AND rep_tx.status_id = 1
    WHERE a.account_number = $1 AND init_tx.status_id = 1
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
    LEFT JOIN transactions rep_tx ON rep_tx.id = lp_rep.transaction_id AND rep_tx.status_id = 1
    WHERE l.loan_number = $1 AND init_tx.status_id = 1
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
  amount: number,
  t?: ITask<{}>
): Promise<RepayLoanResult> => {
  let result: RepayLoanResult = { success: false, error: "internalError" };

  const executeRepayment = async (tx: ITask<{}>) => {
    // Validate amount
    if (amount <= 0) { result = { success: false, error: "invalidRepaymentAmount" }; return; }

    // Get loan ID
    const loanId = await getLoanIdFromNumber(loanNumber, tx);
    if (loanId == null) { result = { success: false, error: "loanNotFound" }; return; }

    // Get commercial-bank account no.
    const bankAccNo = await getCommercialBankAccountNumber(tx);
    if (bankAccNo == null) { result = { success: false, error: "internalError" }; return; }


    // Get outstanding amount to pay
    const outstanding = await getOutstandingLoanAmount(loanNumber, tx);
    const repayment = Math.min(amount, outstanding); // Prevent overpayment


    // Create repayment transaction
    const transaction = await createTransaction(bankAccNo, accountNumber, repayment, `Repayment of loan ${loanNumber}`, 'commercial-bank', 'commercial-bank', undefined, tx);

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
    await tx.none(`
      INSERT INTO loan_payments (loan_id, transaction_id, is_interest)
      VALUES ($1, $2, false)
      `,
      [loanId, transaction.transaction_id]
    );

    result = { success: true, paid: repayment };
  };

  // Use existing db transaction task if available
  if (t != null) { await executeRepayment(t) }
  else           { await db.tx(executeRepayment); }

  return result;
};

// Charge interest on all outstanding loans
export const chargeInterest = async () => {
  logger.info('Starting interest collection process');
  
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

    logger.info(`Found ${loansWithBalance.length} loans with outstanding balances for interest collection`);

    const bankAccNo = await getCommercialBankAccountNumber(t);
    if (!bankAccNo) {
      logger.error('Failed to get commercial bank account number');
      return;
    }

    let totalInterestCollected = 0;
    let successfulCharges = 0;
    let writtenOffLoans = 0;

    // Charge interest on each loan
    for (const loan of loansWithBalance) {
      const outstandingAmount = parseFloat(loan.outstanding_amount);
      const interestRate = parseFloat(loan.interest_rate);
      const interestCharge = outstandingAmount * interestRate;

      logger.info(`Processing loan ${loan.loan_number}: outstanding=${outstandingAmount}, rate=${interestRate}, charge=${interestCharge}`);

      if (interestCharge > 0) {
        // Check if borrower has sufficient funds for interest payment
        const borrowerBalance = await getAccountBalance(loan.account_number, t);
        
        logger.info(`Account ${loan.account_number} balance: ${borrowerBalance}, required: ${interestCharge}`);
        
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

          totalInterestCollected += interestCharge;
          successfulCharges++;
          logger.info(`Successfully charged interest ${interestCharge} on loan ${loan.loan_number}`);
          } catch (error: any) {
            // If transaction fails due to insufficient funds, write off the loan
            if (error.code === 'check_violation' || error.message?.includes('Insufficient funds')) {
              await t.none(`
                UPDATE loans SET write_off = TRUE WHERE id = $1
              `, [loan.loan_id]);
              
              writtenOffLoans++;
              logger.warn(`Loan ${loan.loan_number} written off due to transaction failure: ${error.message}`);
            } else {
              logger.error(`Error charging interest on loan ${loan.loan_number}:`, error);
              throw error; // Re-throw other errors
            }
          }
        } else {
          // Insufficient funds - write off the loan
          await t.none(`
            UPDATE loans SET write_off = TRUE WHERE id = $1
          `, [loan.loan_id]);
          
          writtenOffLoans++;
          logger.warn(`Loan ${loan.loan_number} written off due to insufficient funds (balance: ${borrowerBalance}, required: ${interestCharge})`);
        }
      } else {
        logger.info(`Skipping loan ${loan.loan_number} - no interest charge calculated`);
      }
    }

    logger.info(`Interest collection completed: ${successfulCharges} charges, total collected: ${totalInterestCollected}, ${writtenOffLoans} loans written off`);
  });
};

// 'Smart' debit order system for repayments on loans:
// - Calculate instalment as percentage of initial loan amounts (not outstanding)
// - Only proceed if instalment amount is within account balance threshold
// - Pay loans in order of highest interest rate first
// NOTE: instalmentPercentage should be < balancePercentageThreshold to enable a forgiving repayment plan
export const attemptInstalments = async (
  instalmentPercentage: number = 0.10,          // Instalment amount is calculated as 10% of the initial investment
  balancePercentageThreshold: number = 0.085,   // Instalment will only be paid if it's < 8.5% of account balance
  ignoreAccounts: Set<string> = new Set()       // Accounts to ignore when paying loans
) => {
  logger.info(`Starting instalment collection process with ${instalmentPercentage * 100}% instalment rate and ${balancePercentageThreshold * 100}% balance threshold`);
  
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
      LEFT JOIN transactions rep_tx ON lp.transaction_id = rep_tx.id AND rep_tx.status_id = 1
      WHERE l.write_off = FALSE AND init_tx.status_id = 1
      GROUP BY a.account_number
      HAVING COALESCE(SUM(init_tx.amount), 0) - COALESCE(SUM(rep_tx.amount), 0) > 0
    `);

    logger.info(`Found ${accountsWithLoans.length} accounts with outstanding loans for instalment processing`);
    
    if (ignoreAccounts.size > 0) {
      logger.info(`Ignoring ${ignoreAccounts.size} accounts: [${Array.from(ignoreAccounts).join(', ')}]`);
    }

    let totalAccountsProcessed = 0;
    let totalAccountsSkipped = 0;
    let totalInstalmentsPaid = 0;
    let totalAmountCollected = 0;

    // Loop through all accounts to determine credibility for instalment
    for (const { account_number } of accountsWithLoans) {
      // Skip ignored accounts
      if (ignoreAccounts.has(account_number)) {
        logger.info(`Skipping ignored account: ${account_number}`);
        totalAccountsSkipped++;
        continue;
      }

      // Get account balance
      const balance = await getAccountBalance(account_number, t);
      if (balance == null) {
        logger.warn(`Account ${account_number} not found, skipping`);
        totalAccountsSkipped++;
        continue;
      }

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
        LEFT JOIN transactions rep_tx ON rep_tx.id = lp_rep.transaction_id AND rep_tx.status_id = 1
        WHERE ar.account_number = $1 AND init_tx.status_id = 1
        GROUP BY l.loan_number, init_tx.amount, l.interest_rate
        HAVING GREATEST(0, init_tx.amount - COALESCE(SUM(rep_tx.amount), 0)) > 0
      `, [account_number]);
      
      const loans = loansRaw.map(loan => ({
        loan_number: loan.loan_number,
        initial_amount: parseFloat(loan.initial_amount),
        outstanding_amount: parseFloat(loan.outstanding_amount),
        interest_rate: parseFloat(loan.interest_rate)
      }));

      if (loans.length === 0) {
        logger.info(`No outstanding loans for account ${account_number}`);
        continue;
      }

      logger.info(`Processing account ${account_number} with ${loans.length} outstanding loans`);

      // Calculate instalment total based on initial amounts (as per comment)
      const totalInitialAmount = loans.reduce((sum, loan) => sum + loan.initial_amount, 0);
      let instalTotal = totalInitialAmount * instalmentPercentage;

      logger.info(`Account ${account_number}: balance=${balance}, threshold=${threshold}, totalInitial=${totalInitialAmount}, instalTotal=${instalTotal}`);

      // If instalment amount exceeds threshold, skip this round
      if (instalTotal > threshold) {
        logger.info(`Instalment ${instalTotal} exceeds threshold ${threshold} for account ${account_number}, skipping`);
        totalAccountsSkipped++;
        continue;
      }

      // Sort loans by highest interest rate, then highest outstanding amount
      const sortedLoans = loans.sort((a, b) =>
        b.interest_rate - a.interest_rate || b.outstanding_amount - a.outstanding_amount
      );

      logger.info(`Loan priority order for ${account_number}: ${sortedLoans.map(l => `${l.loan_number}(${l.interest_rate}%)`).join(', ')}`);

      // Pay off as much as possible of each loan, whittling down instalTotal
      let totalPaid = 0;
      let paymentsCount = 0;
      for (const loan of sortedLoans) {
        if (instalTotal <= 0) {
          logger.info(`Instalment budget exhausted for account ${account_number}`);
          break;
        }
        
        const payAmount = Math.min(loan.outstanding_amount, instalTotal);
        logger.info(`Attempting payment of ${payAmount} on loan ${loan.loan_number} (outstanding: ${loan.outstanding_amount})`);

        if (payAmount > 0) {
          const result = await repayLoan(loan.loan_number, account_number, payAmount, t);
          if (result.success) {
            instalTotal -= payAmount;
            totalPaid += payAmount;
            paymentsCount++;
            logger.info(`Successfully paid ${payAmount} on loan ${loan.loan_number} for account ${account_number}`);
          } else {
            logger.error(`Failed to pay ${payAmount} on loan ${loan.loan_number} for account ${account_number}: ${result.error}`);
          }
        }
      }
      
      if (totalPaid > 0) {
        logger.info(`Account ${account_number} completed: ${paymentsCount} payments totaling ${totalPaid}`);
        totalInstalmentsPaid += paymentsCount;
        totalAmountCollected += totalPaid;
      } else {
        logger.info(`No payments made for account ${account_number}`);
      }
      
      totalAccountsProcessed++;
    }

    logger.info(`Instalment collection completed: ${totalAccountsProcessed} accounts processed, ${totalAccountsSkipped} skipped, ${totalInstalmentsPaid} payments made, total collected: ${totalAmountCollected}`);
  });
};