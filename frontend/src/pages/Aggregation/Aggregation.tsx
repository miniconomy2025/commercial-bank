import { useEffect, useState } from 'react';
import AccountFilter from '../../components/AccountFilter/AccountFilter';
import Chart from '../../components/LineChart/LineChart';
import RecentTransactions from '../../components/Transactions/Transactions';
import './Aggregation.css';
import type { Account } from '../../types/Accounts';
import { apiGet } from '../../services/api';

// const accounts = [
//   { id: 'A', name: 'Account A', color: '#10b981' },
//   { id: 'B', name: 'Account B', color: '#dc2626' },
//   { id: 'C', name: 'Account C', color: '#3b82f6' },
//   { id: 'D', name: 'Account D', color: '#f59e0b' },
//   { id: 'E', name: 'Account E', color: '#8b5cf6' },
//   { id: 'F', name: 'Account F', color: '#06b6d4' }
// ];

const transactions = [
  {
    id: 1,
    company: 'Johnson & Associates LLC',
    type: 'Wire Transfer',
    date: '2024-01-15',
    txnId: 'TXN001',
    amount: '+R125,000',
    status: 'Failed',
    icon: '🏢',
    iconBg: '#dbeafe'
  },
  {
    id: 2,
    company: 'Sarah Mitchell',
    type: 'Loan Payment',
    date: '2024-01-15',
    txnId: 'TXN002',
    amount: '+R2,500',
    status: 'Completed',
    icon: '👤',
    iconBg: '#f3e8ff'
  },
  {
    id: 3,
    company: 'Tech Solutions Inc',
    type: 'Business Deposit',
    date: '2024-01-14',
    txnId: 'TXN003',
    amount: '+R45,000',
    status: 'Pending',
    icon: '🏢',
    iconBg: '#dbeafe'
  },
  {
    id: 4,
    company: 'Michael Chen',
    type: 'Mortgage Payment',
    date: '2024-01-14',
    txnId: 'TXN004',
    amount: '+R3,200',
    status: 'Completed',
    icon: '👤',
    iconBg: '#f3e8ff'
  },
  {
    id: 5,
    company: 'Global Industries Ltd',
    type: 'International Transfer',
    date: '2024-01-13',
    txnId: 'TXN005',
    amount: '+R89,500',
    status: 'Completed',
    icon: '🏢',
    iconBg: '#dbeafe'
  }
];

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
  const [selectedAccounts, setSelectedAccounts] = useState(['A', 'B', 'C', 'D', 'E', 'F']);
   const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Account[]>('/dashboard/accounts')
      .then(setAccounts)
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
