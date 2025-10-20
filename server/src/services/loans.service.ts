import { createLoan, getLoanDetails, getLoanIdFromNumber, getLoanSummariesForAccount, getOutstandingLoanAmount, getTotalOutstandingLoansForAccount, maxLoanableAmount, repayLoan, setLoanInterestRate } from '../queries/loans.queries';
import { logger } from '../utils/logger';
import db from '../config/db.config';

export async function createNewLoan(params: { borrowerAccNo: string; amount: number }) {
  const { borrowerAccNo, amount } = params;
  const accountExists = await db.oneOrNone('SELECT 1 FROM accounts WHERE account_number = $1', [borrowerAccNo]);
  if (!accountExists) return { success: false, error: 'accountNotFound' } as const;
  const frozenStatus = await db.oneOrNone('SELECT is_account_frozen($1) AS frozen', [borrowerAccNo]);
  if (frozenStatus?.frozen) return { success: false, error: 'loanNotPermitted' } as const;
  const outstandingLoans = await getTotalOutstandingLoansForAccount(borrowerAccNo);
  if (outstandingLoans + amount > maxLoanableAmount) return { success: false, error: 'loanNotPermitted' } as const;
  const loanResult = await createLoan(borrowerAccNo, amount);
  return loanResult;
}

export async function fetchLoansForAccount(accountNumber: string) {
  const loanSummaries = await getLoanSummariesForAccount(accountNumber);
  return loanSummaries;
}

export async function repayLoanForNumber(params: { loan_number: string; accNo: string; amount: number }) {
  const { loan_number, accNo, amount } = params;
  const loanId = await getLoanIdFromNumber(loan_number);
  if (!loanId) return { kind: 'loanNotFound' } as const;
  const loanSummary = await db.oneOrNone('SELECT write_off FROM loans WHERE loan_number = $1', [loan_number]);
  if (loanSummary?.write_off) return { kind: 'loanWrittenOff' } as const;
  const outstanding = await getOutstandingLoanAmount(loan_number);
  if (outstanding <= 0) return { kind: 'loanPaidOff' } as const;
  const accountStatus = await db.oneOrNone('SELECT get_account_balance($1) AS balance', [accNo]);
  if (!accountStatus || accountStatus.balance < amount) return { kind: 'paymentNotPermitted' } as const;
  const repayment = await repayLoan(loan_number, accNo, amount);
  return { kind: 'ok', repayment } as const;
}

export async function fetchLoanDetails(params: { loan_number: string; accNo: string }) {
  const { loan_number, accNo } = params;
  const loanDetails = await getLoanDetails(loan_number, accNo);
  return loanDetails;
}

export function updatePrimeRate(primeRate: number) {
  setLoanInterestRate(Number(primeRate));
}


