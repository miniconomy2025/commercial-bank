import { useEffect, useState, useRef, useCallback } from 'react';
import RecentTransactions from '../../components/Transactions/Transactions';
import AccountSelector from '../../components/AccountSelector/AccountSelector';
import PieChart from '../../components/PieChart/PieChart';
import './Accounts.css';
import { apiGet } from '../../services/api';
import type { Account } from '../../types/Accounts';
import Chart from '../../components/LineChart/LineChart';
import type { Transaction } from '../../types/Transaction';
import type { Loan } from '../../types/Loan';
import { usePolling } from '../../hooks/usePolling';

const processAccountBalance = (account: Account, transactions: Transaction[], maxPoints = 15) => {
  if (!transactions.length) return { data: [], yKeys: [] };

  const txns = transactions
    .map(txn => ({
      ...txn,
      time: Number(txn.timestamp) || 0,
      amount: Number(txn.amount) || 0,
    }))
    .filter(txn => !isNaN(txn.time) && !isNaN(txn.amount))
    .sort((a, b) => a.time - b.time);

  let uniqueTimes = Array.from(new Set(txns.map(t => t.timestamp))).sort((a, b) => a - b);

  if (uniqueTimes.length > maxPoints) {
    const step = (uniqueTimes.length - 1) / (maxPoints - 1);
    uniqueTimes = Array.from({ length: maxPoints }, (_, i) =>
      uniqueTimes[Math.floor(i * step)]
    );
  }

  let balance = 0;
  let txnIndex = 0;

  const data = uniqueTimes.map(time => {
    while (txnIndex < txns.length && txns[txnIndex].time <= time) {
      const txn = txns[txnIndex];
      if (txn.from === account.name) balance -= txn.amount;
      if (txn.to === account.name) balance += txn.amount;
      txnIndex++;
    }
    return { epoch: time, [account.name]: balance };
  });

  return { data, yKeys: [account.name] };
};

const processLoanRepayments = (account: Account, transactions: Transaction[], maxPoints = 15) => {
  const loanTransactions = transactions.filter(t => 
    t.description && t.description.includes('Repayment of loan')
  );
  
  if (!loanTransactions.length) return { data: [], yKeys: [] };

  const txns = loanTransactions
    .map(txn => ({
      ...txn,
      time: Number(txn.timestamp) || 0,
      amount: Number(txn.amount) || 0,
    }))
    .filter(txn => !isNaN(txn.time) && !isNaN(txn.amount))
    .sort((a, b) => a.time - b.time);

  let uniqueTimes = Array.from(new Set(txns.map(t => t.timestamp))).sort((a, b) => a - b);

  if (uniqueTimes.length > maxPoints) {
    const step = (uniqueTimes.length - 1) / (maxPoints - 1);
    uniqueTimes = Array.from({ length: maxPoints }, (_, i) =>
      uniqueTimes[Math.floor(i * step)]
    );
  }

  let totalRepaid = 0;
  let txnIndex = 0;

  const data = uniqueTimes.map(time => {
    while (txnIndex < txns.length && txns[txnIndex].time <= time) {
      const txn = txns[txnIndex];
      if (txn.from === account.name) totalRepaid += txn.amount;
      txnIndex++;
    }
    return { epoch: time, 'Total Repaid': totalRepaid };
  });

  return { data, yKeys: ['Total Repaid'] };
};

const IndividualAccountContent = () => {
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const lastTransactionTimeRef = useRef<number>(0);
  const isInitialLoadRef = useRef(true);
  const currentAccountRef = useRef<string | null>(null);

  const selectedAccount = accounts.find(acc => selectedAccounts.includes(acc.id)) || accounts[0];

  const updateTransactions = useCallback((newTransactions: Transaction[]) => {
    setTransactions(prevTransactions => {
      const existingIds = new Set(prevTransactions.map(t => 
        t.transaction_number || `${t.timestamp}-${t.amount}-${t.from}-${t.to}`
      ));
      const uniqueNewTransactions = newTransactions.filter(t => 
        !existingIds.has(t.transaction_number || `${t.timestamp}-${t.amount}-${t.from}-${t.to}`)
      );
      
      if (uniqueNewTransactions.length === 0) {
        return prevTransactions;
      }
      
      const latestTime = Math.max(...newTransactions.map(t => Number(t.timestamp) || 0));
      lastTransactionTimeRef.current = Math.max(lastTransactionTimeRef.current, latestTime);
      
      return [...prevTransactions, ...uniqueNewTransactions].sort((a, b) => 
        (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0)
      );
    });
  }, []);

  // Memoized function to update loans without causing re-renders
  const updateLoans = useCallback((newLoans: Loan[]) => {
    setLoans(prevLoans => {
      // Check if there are any changes in loan data
      const loansChanged = newLoans.some(newLoan => {
        const existingLoan = prevLoans.find(l => l.loan_number === newLoan.loan_number);
        return !existingLoan || 
               existingLoan.outstanding_amount !== newLoan.outstanding_amount ||
               existingLoan.initial_amount !== newLoan.initial_amount;
      });

      if (!loansChanged && newLoans.length === prevLoans.length) {
        return prevLoans; // No changes, return same reference
      }

      return newLoans;
    });
  }, []);

  // Memoized function to update accounts without causing re-renders
  const updateAccounts = useCallback((newAccounts: Account[]) => {
    setAccounts(prevAccounts => {
      // Check if there are any changes in account data
      const accountsChanged = newAccounts.some(newAccount => {
        const existingAccount = prevAccounts.find(a => a.id === newAccount.id);
        return !existingAccount || 
               existingAccount.balance !== newAccount.balance ||
               existingAccount.loanBalance !== newAccount.loanBalance ||
               existingAccount.income !== newAccount.income ||
               existingAccount.expenses !== newAccount.expenses;
      });

      if (!accountsChanged && newAccounts.length === prevAccounts.length) {
        return prevAccounts; // No changes, return same reference
      }

      return newAccounts;
    });
  }, []);

  // Polling function that only fetches new data
  const pollForUpdates = useCallback(async () => {
    if (isInitialLoadRef.current || !currentAccountRef.current) return;

    try {
      setIsPolling(true);
      const currentAccount = accounts.find(a => a.id === currentAccountRef.current);
      if (!currentAccount) return;

      const transactionsResponse = await apiGet<{ success: boolean; transactions: Transaction[] }>(`/dashboard/transactions?account=${currentAccount.name}`);
      
      if (transactionsResponse.success) {
        const newTransactions = transactionsResponse.transactions.filter(t => 
          Number(t.timestamp) > lastTransactionTimeRef.current
        );
        
        if (newTransactions.length > 0) {
          updateTransactions(newTransactions);
        }
      }
      
      const loansResponse = await apiGet<{ success: boolean; loans: Loan[] }>(`/dashboard/loans?accountNumber=${currentAccount.account_number}`);
      if (loansResponse.success) {
        updateLoans(loansResponse.loans);
      }
      
      const accountsResponse = await apiGet<{ success: boolean; accounts: Account[] }>('/dashboard/accounts');
      if (accountsResponse.success) {
        const uniqueAccounts = accountsResponse.accounts.filter((account, index, self) => 
          index === self.findIndex(a => a.id === account.id)
        );
        updateAccounts(uniqueAccounts);
      }
      
    } catch (err) {
      console.error('Polling error:', err);
    } finally {
      setIsPolling(false);
    }
  }, [updateTransactions, updateLoans, updateAccounts, accounts]);

  // Initial accounts fetch
  useEffect(() => {
    const initialFetch = async () => {
      try {
        setIsLoading(true);
        const accountsResponse = await apiGet<{ success: boolean; accounts: Account[] }>('/dashboard/accounts');
        
        if (!accountsResponse.success) {
          throw new Error('Failed to fetch accounts');
        }

        const fetchedAccounts = accountsResponse.accounts;
        // Remove duplicates based on account id
        const uniqueAccounts = fetchedAccounts.filter((account, index, self) => 
          index === self.findIndex(a => a.id === account.id)
        );
        setAccounts(uniqueAccounts);
        
        if (uniqueAccounts.length > 0) {
          setSelectedAccounts([uniqueAccounts[0].id]);
        }
        
        isInitialLoadRef.current = false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        isInitialLoadRef.current = false;
      } finally {
        setIsLoading(false);
      }
    };

    initialFetch();
  }, []);

  // Fetch transactions and loans when account changes
  useEffect(() => {
    if (!selectedAccount) return;

    const fetchAccountData = async () => {
      try {
        setIsTransactionsLoading(true);
        currentAccountRef.current = selectedAccount.id;
        
        const [transactionsResponse, loansResponse] = await Promise.all([
          apiGet<{ success: boolean; transactions: Transaction[] }>(`/dashboard/transactions?account=${selectedAccount.name}`),
          apiGet<{ success: boolean; loans: Loan[] }>(`/dashboard/loans?accountNumber=${selectedAccount.account_number}`)
        ]);
        
        if (transactionsResponse.success) {
          setTransactions(transactionsResponse.transactions);
          
          // Update last transaction time
          if (transactionsResponse.transactions.length > 0) {
            lastTransactionTimeRef.current = Math.max(...transactionsResponse.transactions.map(t => Number(t.timestamp) || 0));
          }
        } else {
          console.error('Failed to fetch transactions:', transactionsResponse);
          setTransactions([]);
        }

        if (loansResponse.success) {
          setLoans(loansResponse.loans);
        } else {
          console.error('Failed to fetch loans:', loansResponse);
          setLoans([]);
        }
        
      } catch (err) {
        console.error('Error fetching account data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsTransactionsLoading(false);
      }
    };

    fetchAccountData();
  }, [selectedAccount]);

  // Setup polling with custom hook
  usePolling(pollForUpdates, {
    enabled: !isInitialLoadRef.current && !!currentAccountRef.current,
    interval: 3000
  });

  const { data: balanceChartData, yKeys: balanceChartYKeys } = processAccountBalance(selectedAccount, transactions);
  const { data: loanChartData, yKeys: loanChartYKeys } = processLoanRepayments(selectedAccount, transactions);

  const totalEquity = loans.reduce((sum, loan) => {
    const initialAmount = parseFloat(loan.initial_amount) || 0;
    const outstandingAmount = parseFloat(loan.outstanding_amount) || 0;
    const equity = initialAmount - outstandingAmount;
    return sum + equity;
  }, 0).toFixed(2);
 
  if (isLoading) {
    return (
      <main className="account-content">
        <div className="loading-container">
          <p>Loading accounts...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="account-content">
        <div className="error-container">
          <p>Error: {error}</p>
        </div>
      </main>
    );
  }

  if (accounts.length === 0) {
    return (
      <main className="account-content">
        <div className="empty-state">
          <p>No accounts found</p>
        </div>
      </main>
    );
  }

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
      {isPolling && (
        <div style={{ 
          position: 'fixed', 
          top: '10px', 
          right: '10px', 
          background: '#007bff', 
          color: 'white', 
          padding: '8px 12px', 
          borderRadius: '4px', 
          fontSize: '12px',
          zIndex: 1000
        }}>
          Refreshing data...
        </div>
      )}
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
              <div>
                <h3 className="metric-label">Total Loan Equity</h3>
                <p className="metric-value text-info">
                  {totalEquity}
                </p>
              </div>
            </div>

            <div style={{ marginTop: '32px' }}>
              <PieChart loans={loans} title="Loan Breakdown" />
              <Chart
                title="Account balances over time"
                data={balanceChartData}
                xKey="epoch"
                yKeys={balanceChartYKeys}
              />
              <Chart
                title="Loan Repayments over time"
                data={loanChartData}
                xKey="epoch"
                yKeys={loanChartYKeys}
              />

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