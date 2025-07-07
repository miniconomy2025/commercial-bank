import { useState } from 'react';
import RecentTransactions from '../../components/Transactions/Transactions';
import AccountSelector from '../../components/AccountSelector/AccountSelector';
import PieChart from '../../components/PieChart/PieChart';
import './Accounts.css';

const accounts = [
  { id: '1', name: 'Main Account', color: '#3b82f6' },
  { id: '2', name: 'Savings Account', color: '#10b981' },
  { id: '3', name: 'Investment Account', color: '#f59e0b' },
  { id: '4', name: 'Emergency Fund', color: '#8b5cf6' }
];

const transactions = [
  { id: 1, company: 'Apple Store', type: 'Purchase', amount: '+R2,500', status: 'Completed', icon: '🍎', iconBg: '#f3f4f6' },
  { id: 2, company: 'Netflix', type: 'Subscription', amount: '-R199', status: 'Completed', icon: '📺', iconBg: '#fef3c7' },
  { id: 3, company: 'Uber', type: 'Transport', amount: '-R85', status: 'Pending', icon: '🚗', iconBg: '#dbeafe' },
  { id: 4, company: 'Woolworths', type: 'Groceries', amount: '-R450', status: 'Completed', icon: '🛒', iconBg: '#dcfce7' },
  { id: 5, company: 'Salary', type: 'Income', amount: '+R15,000', status: 'Completed', icon: '💰', iconBg: '#f0fdf4' }
];

const IndividualAccountContent = () => {
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(['1']);
  const selectedAccount = accounts.find(acc => selectedAccounts.includes(acc.id)) || accounts[0];

  const expenseData = [
    { label: 'Office Supplies', value: 2500, color: '#3b82f6' },
    { label: 'Equipment', value: 4000, color: '#10b981' },
    { label: 'Software', value: 1500, color: '#f59e0b' },
    { label: 'Services', value: 2000, color: '#8b5cf6' }
  ];

  const accountStats = {
    balance: 'R1,000,000',
    loansOutstanding: 'R10,000',
    totalMoneyIn: 'R125,000',
    totalMoneyOut: 'R15,000'
  };

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
              <span
                className="account-dot"
                style={{ backgroundColor: selectedAccount.color }}
              />
              {selectedAccount.name}
            </h2>

            <div className="account-metrics">
              <div>
                <h3 className="metric-label">Balance</h3>
                <p className="metric-value text-dark">{accountStats.balance}</p>
              </div>
              <div>
                <h3 className="metric-label">Loans Outstanding</h3>
                <p className="metric-value text-danger">{accountStats.loansOutstanding}</p>
              </div>
              <div>
                <h3 className="metric-label">Total Money In</h3>
                <p className="metric-value text-success">{accountStats.totalMoneyIn}</p>
              </div>
              <div>
                <h3 className="metric-label">Total Money Out</h3>
                <p className="metric-value text-danger">{accountStats.totalMoneyOut}</p>
              </div>
            </div>

            <div style={{ marginTop: '32px' }}>
              <PieChart data={expenseData} title="Expense Breakdown" />
            </div>
          </article>
        </div>

        <aside className="account-right">
          <RecentTransactions transactions={transactions} />
        </aside>
      </section>
    </main>
  );
};

export default IndividualAccountContent;
