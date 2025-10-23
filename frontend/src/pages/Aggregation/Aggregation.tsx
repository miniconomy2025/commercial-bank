import { useEffect, useState, useRef, useCallback } from 'react';
import AccountFilter from '../../components/AccountFilter/AccountFilter';
import Chart from '../../components/LineChart/LineChart';
import RecentTransactions from '../../components/Transactions/Transactions';
import './Aggregation.css';
import type { Account } from '../../types/Accounts';
import type { Transaction } from '../../types/Transaction';
import { apiGet } from '../../services/api';

const processBalanceData = (
  accounts: Account[],
  selectedAccounts: string[],
  transactions: Transaction[],
  maxPoints = 15
): {
  data: any[],
  yKeys: string[]
} => {
  if (!accounts.length || !selectedAccounts.length || !transactions.length) {
    return { data: [], yKeys: [] };
  }

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

  const balancesByAccount: Record<string, number[]> = {};

  selectedAccounts.forEach(accountId => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    const balances: number[] = [];
    let balance = parseFloat(account.loanBalance) || 0; // Start with current loan balance
    let txnIndex = 0;

    uniqueTimes.forEach(time => {
      while (txnIndex < txns.length && txns[txnIndex].time <= time) {
        const txn = txns[txnIndex];
        if (txn.from === account.name) balance -= txn.amount;
        if (txn.to === account.name) balance += txn.amount;
        txnIndex++;
      }
      balances.push(balance);
    });

    balancesByAccount[account.name] = balances;
  });

  const chartData = uniqueTimes.map((time, index) => {
    const row: Record<string, number> = { epoch: time };
    selectedAccounts.forEach(accountId => {
      const account = accounts.find(a => a.id === accountId);
      if (account) {
        row[account.name] = balancesByAccount[account.name]?.[index] || 0;
      }
    });
    return row;
  });

  const yKeys = selectedAccounts
    .map(id => accounts.find(a => a.id === id)?.name)
    .filter((name): name is string => !!name);

  return { data: chartData, yKeys };
};

const AggregationContent = () => {
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Refs to track polling state and prevent unnecessary re-renders
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTransactionTimeRef = useRef<number>(0);
  const isInitialLoadRef = useRef(true);

  // Memoized function to update transactions without causing re-renders
  const updateTransactions = useCallback((newTransactions: Transaction[]) => {
    setTransactions(prevTransactions => {
      // Filter out transactions we already have
      const existingIds = new Set(prevTransactions.map(t => t.transaction_number || `${t.timestamp}-${t.amount}-${t.from}-${t.to}`));
      const uniqueNewTransactions = newTransactions.filter(t => 
        !existingIds.has(t.transaction_number || `${t.timestamp}-${t.amount}-${t.from}-${t.to}`)
      );
      
      if (uniqueNewTransactions.length === 0) {
        return prevTransactions; // No new transactions, return same reference
      }
      
      // Update last transaction time
      const latestTime = Math.max(...newTransactions.map(t => Number(t.timestamp) || 0));
      lastTransactionTimeRef.current = Math.max(lastTransactionTimeRef.current, latestTime);
      
      // Return new array with appended transactions
      return [...prevTransactions, ...uniqueNewTransactions].sort((a, b) => 
        (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0)
      );
    });
  }, []);

  // Polling function that only fetches new data
  const pollForUpdates = useCallback(async () => {
    if (isInitialLoadRef.current) return; // Skip polling during initial load

    try {
      // Fetch all transactions to avoid duplicates
      const response = await apiGet<{ success: boolean; transactions: Transaction[] }>('/dashboard/transactions');
      const allTransactions = response.success ? response.transactions : [];
      
      // Filter transactions newer than our last known transaction
      const newTransactions = allTransactions.filter(t => 
        Number(t.timestamp) > lastTransactionTimeRef.current
      );
      
      if (newTransactions.length > 0) {
        updateTransactions(newTransactions);
      }
      
      // Optionally check for new accounts (less frequent)
      const accountsResponse = await apiGet<{ success: boolean; accounts: Account[] }>('/dashboard/accounts');
      if (accountsResponse.success) {
        setAccounts(prevAccounts => {
          const accountIds = new Set(prevAccounts.map(a => a.id));
          const newAccounts = accountsResponse.accounts.filter(a => !accountIds.has(a.id));
          
          if (newAccounts.length === 0) {
            return prevAccounts; // No new accounts, return same reference
          }
          
          // Auto-select new accounts
          setSelectedAccounts(prev => [...prev, ...newAccounts.map(a => a.id)]);
          return [...prevAccounts, ...newAccounts];
        });
      }
      
    } catch (err: any) {
      console.error('Polling error:', err);
      // Don't update error state to avoid re-renders, just log
    }
  }, [updateTransactions, selectedAccounts, accounts]);

  // Initial data fetch
  useEffect(() => {
    const initialFetch = async () => {
      try {
        // Fetch accounts first
        const accountsResponse = await apiGet<{ success: boolean; accounts: Account[] }>('/dashboard/accounts');
        
        if (!accountsResponse.success) {
          throw new Error('Failed to fetch accounts');
        }

        const fetchedAccounts = accountsResponse.accounts;
        setAccounts(fetchedAccounts);
        setSelectedAccounts(fetchedAccounts
          .filter(acc => acc.name !== 'commercial-bank' && acc.name !== 'thoh')
          .map(acc => acc.id));
        
        // Fetch all transactions once to avoid duplicates
        try {
          const response = await apiGet<{ success: boolean; transactions: Transaction[] }>('/dashboard/transactions');
          const allTransactions = response.success ? response.transactions : [];
        
          setTransactions(allTransactions);
          
          // Update last transaction time
          if (allTransactions.length > 0) {
            lastTransactionTimeRef.current = Math.max(...allTransactions.map(t => Number(t.timestamp) || 0));
          }
        } catch (err) {
          console.error('Error fetching transactions:', err);
        }
        
        isInitialLoadRef.current = false;
      } catch (err: any) {
        setError(err.message);
        isInitialLoadRef.current = false;
      }
    };

    initialFetch();
  }, []);

  // Setup polling
  useEffect(() => {
    if (isInitialLoadRef.current || selectedAccounts.length === 0) return; // Don't start polling until initial load is complete and accounts are selected

    // Start polling every 5 seconds (adjust as needed)
    pollingIntervalRef.current = setInterval(pollForUpdates, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [pollForUpdates, selectedAccounts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const { data: loanChartData, yKeys: loanChartYKeys } = processBalanceData(
    accounts,
    selectedAccounts,
    transactions
  );

  if (error) {
    return (
      <div className="aggregation-container">
        <div className="error-message">
          Error loading data: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="aggregation-container">
      <div className="charts-column">
        <article className="charts-panel">
          <AccountFilter
            selectedAccounts={selectedAccounts}
            handleAccountToggle={handleAccountToggle}
            accounts={accounts}
          />
          <div className="chart-section">
            <Chart
                title="Loan Repayments over time"
                data={loanChartData}
                xKey="epoch"
                yKeys={loanChartYKeys}
              />
          </div>
        </article>
      </div>
      <RecentTransactions transactions={transactions} />
    </div>
  );
};

export default AggregationContent;