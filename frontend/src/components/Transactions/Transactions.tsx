import React, { useState } from 'react';
import TransactionItem from '../TransactionItem/TransactionItem';
import './Transactions.css';
import type { Transaction } from '../../types/Transaction';

interface RecentTransactionsProps {
  transactions: Transaction[];
}

const ITEMS_PER_PAGE = 5;

const RecentTransactions: React.FC<RecentTransactionsProps> = ({ transactions }) => {
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const currentItems = transactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePrev = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  };

  const handleNext = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1));
  };

  return (
    <section className="recent-transactions">
      <h3 className="recent-title">Recent Transactions</h3>
      <div className="transaction-list">
        {currentItems.map((transaction) => (
          <TransactionItem key={transaction.transaction_number} transaction={transaction} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination-controls">
          <button onClick={handlePrev} disabled={currentPage === 0}>
            Previous
          </button>
          <span>
            Page {currentPage + 1} of {totalPages}
          </span>
          <button onClick={handleNext} disabled={currentPage === totalPages - 1}>
            Next
          </button>
        </div>
      )}
    </section>
  );
};

export default RecentTransactions;
