import { useEffect, useState } from 'react';
import RecentTransactions from '../../components/Transactions/Transactions';
import AccountSelector from '../../components/AccountSelector/AccountSelector';
import PieChart from '../../components/PieChart/PieChart';
import './Accounts.css';
import { apiGet } from '../../services/api';
import type { Account } from '../../types/Accounts';
import Chart from '../../components/LineChart/LineChart';

const processLoanRepayments = (loans: any[]) => {
  if (!loans.length) return { data: [], yKeys: [] };

  const sortedLoans = [...loans].sort((a, b) => parseFloat(a.started_at) - parseFloat(b.started_at));

  let timePoints: number[] = [];
  sortedLoans.forEach(loan => {
    const start = parseFloat(loan.started_at);
    timePoints.push(start);
    for (let i = 1; i <= 5; i++) {
      timePoints.push(start + i * 30 * 24 * 3600);
    }
  });
  timePoints = Array.from(new Set(timePoints)).sort((a, b) => a - b);

  const data = timePoints.map(time => {
    const point: any = { epoch: time };
    sortedLoans.forEach(loan => {
      const start = parseFloat(loan.started_at);
      const initialAmount = parseFloat(loan.initial_amount);
      const outstanding = parseFloat(loan.outstanding_amount);
      const totalRepaid = initialAmount - outstanding;

      if (time < start) {
        point[loan.loan_number] = 0;
      } else if (time >= start + 5 * 30 * 24 * 3600) {
        point[loan.loan_number] = totalRepaid;
      } else {
        const monthsPassed = (time - start) / (30 * 24 * 3600);
        point[loan.loan_number] = Math.min(totalRepaid, (totalRepaid / 5) * monthsPassed);
      }
    });
    return point;
  });

  const yKeys = sortedLoans.map(loan => loan.loan_number);

  return { data, yKeys };
};


const IndividualAccountContent = () => {
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);

  const selectedAccount = accounts.find(acc => selectedAccounts.includes(acc.id)) || accounts[0];

  useEffect(() => {
    setIsLoading(true);
    apiGet<Account[]>('/dashboard/accounts')
      .then((fetchedAccounts) => {
        setAccounts(fetchedAccounts);
        if (fetchedAccounts.length > 0) {
          setSelectedAccounts([fetchedAccounts[0].id]);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

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

  useEffect(() => {
    if (!selectedAccount) return;
    apiGet<any[]>(`/dashboard/loans?accountNumber=${selectedAccount.account_number}`)
      .then((fetchedLoans) => {
        setLoans(fetchedLoans);
      })
      .catch((err) => setError(err.message));
  }, [selectedAccount]);

  const { data: loanChartData, yKeys: loanChartYKeys } = processLoanRepayments(loans);

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