import { useEffect, useState } from 'react';
import AccountFilter from '../../components/AccountFilter/AccountFilter';
import Chart from '../../components/LineChart/LineChart';
import RecentTransactions from '../../components/Transactions/Transactions';
import './Aggregation.css';
import type { Account } from '../../types/Accounts';
import type { Transaction } from '../../types/Transaction';
import { apiGet } from '../../services/api';

const generatePoints = (index: number, varianceBase: number, yOffset: number): number[] => {
  const points: number[] = [];
  const variance = Math.random() * varianceBase + 10;
  for (let i = 0; i <= 12; i++) {
    const noise = (Math.sin(i * 0.8 + index) + Math.cos(i * 1.2)) * variance;
    const y = yOffset + (index * 15) + noise;
    points.push(Math.max(10, Math.min(150, y)));
  }
  return points;
};

const AggregationContent = () => {
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<any>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Account[]>('/dashboard/accounts')
      .then((fetchedAccounts) => {
        setAccounts(fetchedAccounts);
        setSelectedAccounts(fetchedAccounts.map(acc => acc.id)); // Select all fetched accounts by default
      })
      .catch((err) => setError(err.message));
      
    apiGet<any[]>('/dashboard/transactions')
      .then((fetchedTransactions) => {
        setTransactions(fetchedTransactions);
      })
      .catch((err) => setError(err.message));
  }, []);


  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

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
              selectedAccounts={selectedAccounts}
              title="Balances over time"
              curveFn={(index:number) => generatePoints(index, 30, 40)}
              accounts={accounts}
            />
            <Chart
              selectedAccounts={selectedAccounts}
              title="Loan Repayments over time"
              curveFn={(index:number) => generatePoints(index, 25, 50)}
              accounts={accounts}
            />
          </div>
        </article>
      </div>
      <RecentTransactions transactions={transactions} />
    </div>
  );
};

export default AggregationContent;
