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
  maxPoints = 10
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
      time: Number(txn.time) || 0,
      amount: Number(txn.amount) || 0,
    }))
    .filter(txn => !isNaN(txn.time) && !isNaN(txn.amount))
    .sort((a, b) => a.time - b.time);

  let uniqueTimes = Array.from(new Set(txns.map(t => t.time))).sort((a, b) => a - b);

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
    let balance = 0;
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
  const [transactions, setTransactions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Refs to track polling state and prevent unnecessary re-renders
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTransactionTimeRef = useRef<number>(0);
  const isInitialLoadRef = useRef(true);

  // Memoized function to update transactions without causing re-renders
  const updateTransactions = useCallback((newTransactions: any[]) => {
    setTransactions(prevTransactions => {
      // Filter out transactions we already have
      const existingIds = new Set(prevTransactions.map(t => t.id || `${t.time}-${t.amount}-${t.from}-${t.to}`));
      const uniqueNewTransactions = newTransactions.filter(t => 
        !existingIds.has(t.id || `${t.time}-${t.amount}-${t.from}-${t.to}`)
      );
      
      if (uniqueNewTransactions.length === 0) {
        return prevTransactions; // No new transactions, return same reference
      }
      
      // Update last transaction time
      const latestTime = Math.max(...newTransactions.map(t => Number(t.time) || 0));
      lastTransactionTimeRef.current = Math.max(lastTransactionTimeRef.current, latestTime);
      
      // Return new array with appended transactions
      return [...prevTransactions, ...uniqueNewTransactions].sort((a, b) => 
        (Number(a.time) || 0) - (Number(b.time) || 0)
      );
    });
  }, []);

  // Polling function that only fetches new data
  const pollForUpdates = useCallback(async () => {
    if (isInitialLoadRef.current) return; // Skip polling during initial load

    try {
      // Fetch new transactions since last update
      const fetchedTransactions = await apiGet<any[]>('/dashboard/transactions');
      
      // Filter transactions newer than our last known transaction
      const newTransactions = fetchedTransactions.filter(t => 
        Number(t.time) > lastTransactionTimeRef.current
      );
      
      if (newTransactions.length > 0) {
        updateTransactions(newTransactions);
      }
      
      // Optionally check for new accounts (less frequent)
      // You could make this less frequent by using a counter
      const fetchedAccounts = await apiGet<Account[]>('/dashboard/accounts');
      setAccounts(prevAccounts => {
        const accountIds = new Set(prevAccounts.map(a => a.id));
        const newAccounts = fetchedAccounts.filter(a => !accountIds.has(a.id));
        
        if (newAccounts.length === 0) {
          return prevAccounts; // No new accounts, return same reference
        }
        
        // Auto-select new accounts
        setSelectedAccounts(prev => [...prev, ...newAccounts.map(a => a.id)]);
        return [...prevAccounts, ...newAccounts];
      });
      
    } catch (err: any) {
      console.error('Polling error:', err);
      // Don't update error state to avoid re-renders, just log
    }
  }, [updateTransactions]);

  // Initial data fetch
  useEffect(() => {
    const initialFetch = async () => {
      try {
        const [fetchedAccounts, fetchedTransactions] = await Promise.all([
          apiGet<Account[]>('/dashboard/accounts'),
          apiGet<any[]>('/dashboard/transactions')
        ]);
        
        setAccounts(fetchedAccounts);
        setSelectedAccounts(fetchedAccounts.map(acc => acc.id));
        setTransactions(fetchedTransactions);
        
        // Update last transaction time
        if (fetchedTransactions.length > 0) {
          lastTransactionTimeRef.current = Math.max(...fetchedTransactions.map(t => Number(t.time) || 0));
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
    if (isInitialLoadRef.current) return; // Don't start polling until initial load is complete

    // Start polling every 5 seconds (adjust as needed)
    pollingIntervalRef.current = setInterval(pollForUpdates, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [pollForUpdates]);

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