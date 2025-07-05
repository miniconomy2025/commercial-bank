import React from 'react';
import TransactionItem from '../TransactionItem/TransactionItem';
import './Transactions.css';
import type { Transaction } from '../../types/Transaction';

interface RecentTransactionsProps {
  transactions: Transaction[];
}

const RecentTransactions: React.FC<RecentTransactionsProps> = ({ transactions }) => (
  <section className="recent-transactions">
    <h3 className="recent-title">Recent Transactions</h3>
    <div className="transaction-list">
      {transactions.slice(0, 5).map((transaction) => (
        <TransactionItem key={transaction.id} transaction={transaction} />
      ))}
    </div>
  </section>
);

export default RecentTransactions;
