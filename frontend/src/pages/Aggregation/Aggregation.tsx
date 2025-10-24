import { useEffect, useState, useRef, useCallback } from 'react';
import AccountFilter from '../../components/AccountFilter/AccountFilter';
import Chart from '../../components/LineChart/LineChart';
import RecentTransactions from '../../components/Transactions/Transactions';
import './Aggregation.css';
import type { Account } from '../../types/Accounts';
import type { Transaction } from '../../types/Transaction';
import { apiGet } from '../../services/api';
import { usePolling } from '../../hooks/usePolling';

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
  const [isPolling, setIsPolling] = useState(false);
  
  const lastTransactionTimeRef = useRef<number>(0);
  const isInitialLoadRef = useRef(true);

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

  const pollForUpdates = useCallback(async () => {
    if (isInitialLoadRef.current) return;

    try {
      setIsPolling(true);
      const response = await apiGet<{ success: boolean; transactions: Transaction[] }>('/dashboard/transactions');
      const allTransactions = response.success ? response.transactions : [];
      
      const newTransactions = allTransactions.filter(t => 
        Number(t.timestamp) > lastTransactionTimeRef.current
      );
      
      if (newTransactions.length > 0) {
        updateTransactions(newTransactions);
      }
      
      const accountsResponse = await apiGet<{ success: boolean; accounts: Account[] }>('/dashboard/accounts');
      if (accountsResponse.success) {
        setAccounts(prevAccounts => {
          const accountIds = new Set(prevAccounts.map(a => a.id));
          const uniqueResponseAccounts = accountsResponse.accounts.filter((account, index, self) => 
            index === self.findIndex(a => a.id === account.id)
          );
          const newAccounts = uniqueResponseAccounts.filter(a => !accountIds.has(a.id));
          
          if (newAccounts.length === 0) {
            return prevAccounts;
          }
          
          setSelectedAccounts(prev => [...prev, ...newAccounts.map(a => a.id)]);
          return [...prevAccounts, ...newAccounts];
        });
      }
      
    } catch (err) {
      console.error('Polling error:', err);
    } finally {
      setIsPolling(false);
    }
  }, [updateTransactions]);

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
        // Remove duplicates based on account id
        const uniqueAccounts = fetchedAccounts.filter((account, index, self) => 
          index === self.findIndex(a => a.id === account.id)
        );
        setAccounts(uniqueAccounts);
        setSelectedAccounts(uniqueAccounts
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        isInitialLoadRef.current = false;
      }
    };

    initialFetch();
  }, []);

  // Setup polling with custom hook
  usePolling(pollForUpdates, {
    enabled: !isInitialLoadRef.current,
    interval: 3000
  });

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const { data: balanceChartData, yKeys: balanceChartYKeys } = processBalanceData(
    accounts,
    selectedAccounts,
    transactions
  );
  
  // For loan repayments, we need actual loan payment transactions
  const loanTransactions = transactions.filter(t => 
    t.description && t.description.includes('Repayment of loan')
  );
  const { data: loanChartData, yKeys: loanChartYKeys } = processBalanceData(
    accounts,
    selectedAccounts,
    loanTransactions
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
      <div className="charts-column">
        <article className="charts-panel">
          <AccountFilter
            selectedAccounts={selectedAccounts}
            handleAccountToggle={handleAccountToggle}
            accounts={accounts}
          />
          <div className="chart-section">
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
      <RecentTransactions transactions={transactions} />
    </div>
  );
};

export default AggregationContent;