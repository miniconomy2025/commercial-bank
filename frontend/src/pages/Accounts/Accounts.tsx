import { useEffect, useState } from 'react';
import RecentTransactions from '../../components/Transactions/Transactions';
import AccountSelector from '../../components/AccountSelector/AccountSelector';
import PieChart from '../../components/PieChart/PieChart';
import './Accounts.css';
import { apiGet } from '../../services/api';
import type { Account } from '../../types/Accounts';

const IndividualAccountContent = () => {
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);

  const selectedAccount = accounts.find(acc => selectedAccounts.includes(acc.id)) || accounts[0];

  // First, fetch accounts
  useEffect(() => {
    setIsLoading(true);
    apiGet<Account[]>('/dashboard/accounts')
      .then((fetchedAccounts) => {
        setAccounts(fetchedAccounts);
        // Initialize with only the first account selected
        if (fetchedAccounts.length > 0) {
          setSelectedAccounts([fetchedAccounts[0].id]);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  // Fetch transactions when selected account changes
  useEffect(() => {
    if (!selectedAccount) return;

    setIsTransactionsLoading(true);
    apiGet<any[]>(`/dashboard/transactions?account=${selectedAccount.name}`)
      .then((fetchedTransactions) => {
        setTransactions(fetchedTransactions);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsTransactionsLoading(false));
  }, [selectedAccount]);

  const expenseData = [
    { label: 'Office Supplies', value: 2500, color: '#3b82f6' },
    { label: 'Equipment', value: 4000, color: '#10b981' },
    { label: 'Software', value: 1500, color: '#f59e0b' },
    { label: 'Services', value: 2000, color: '#8b5cf6' }
  ];

  // Show loading state
  if (isLoading) {
    return (
      <main className="account-content">
        <div className="loading-container">
          <p>Loading accounts...</p>
        </div>
      </main>
    );
  }

  // Show error state
  if (error) {
    return (
      <main className="account-content">
        <div className="error-container">
          <p>Error: {error}</p>
        </div>
      </main>
    );
  }

  // Show empty state if no accounts
  if (accounts.length === 0) {
    return (
      <main className="account-content">
        <div className="empty-state">
          <p>No accounts found</p>
        </div>
      </main>
    );
  }

  // Show loading if no selected account yet
  if (!selectedAccount) {
    return (
      <main className="account-content">
        <div className="loading-container">
          <p>Loading account data...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="account-content">
      <AccountSelector
        selectedAccounts={selectedAccounts}
        onAccountSelect={setSelectedAccounts}
        accounts={accounts}
      />

      <section className="account-grid">
        <div className="account-left">
          <article className="account-card">
            <h2 className="account-title">
              {selectedAccount.name}
            </h2>

            <div className="account-metrics">
              <div>
                <h3 className="metric-label">Balance</h3>
                <p className="metric-value text-dark">
                  {selectedAccount.balance || '0'}
                </p>
              </div>
              <div>
                <h3 className="metric-label">Loans Outstanding</h3>
                <p className="metric-value text-danger">
                  {selectedAccount.loanBalance || '0'}
                </p>
              </div>
              <div>
                <h3 className="metric-label">Total Money In</h3>
                <p className="metric-value text-success">
                  {selectedAccount.income || '0'}
                </p>
              </div>
              <div>
                <h3 className="metric-label">Total Money Out</h3>
                <p className="metric-value text-danger">
                  {selectedAccount.expenses || '0'}
                </p>
              </div>
            </div>

            <div style={{ marginTop: '32px' }}>
              <PieChart data={expenseData} title="Expense Breakdown" />
            </div>
          </article>
        </div>

        <aside className="account-right">
          {isTransactionsLoading ? (
            <div className="loading-container">
              <p>Loading transactions...</p>
            </div>
          ) : (
            <RecentTransactions transactions={transactions} />
          )}
        </aside>
      </section>
    </main>
  );
};

export default IndividualAccountContent;