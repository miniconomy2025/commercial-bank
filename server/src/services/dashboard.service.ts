import { getAllAccountExpenses, getAllExistingAccounts, getAllExistingTransactions, getLoanBalances } from '../queries/dashboard.queries';
import { getLoanSummariesForAccount } from '../queries/loans.queries';

export async function getAccountsWithLoanBalance() {
  const accounts = (await getAllExistingAccounts());
  const accountIds = accounts.map((account: any) => account.id);
  const loanBalances = await Promise.all(accountIds.map((id: number) => getLoanBalances(id)));
  const accountsWithLoanBalance = accounts.map((account: any, idx: number) => {
    const loanBalance = loanBalances[idx]?.loan_balance || 0;
    return { ...account, loanBalance };
  });
  return accountsWithLoanBalance;
}

export async function getExpensesForAccount(accountId: number) {
  const expenses = await getAllAccountExpenses(accountId);
  return expenses;
}

export async function getLoansForAccount(accNo: string) {
  const loanSummaries = await getLoanSummariesForAccount(accNo);
  return loanSummaries;
}

export async function getTransactionsForAccount(account: string) {
  const allTransactions = await getAllExistingTransactions(account);
  return allTransactions;
}


