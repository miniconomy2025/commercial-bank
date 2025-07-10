import { useEffect, useState } from 'react';
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
