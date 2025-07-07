import React from 'react';
import './TransactionItem.css';
import type { Transaction } from '../../types/Transaction';



interface TransactionItemProps {
  transaction: Transaction;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction }) => (
  <article className="transaction-item">
    <div className="transaction-left">
      <div
        className="transaction-icon"
        style={{ backgroundColor: transaction.iconBg }}
      >
        {transaction.icon}
      </div>
      <div className="transaction-info">
        <h4 className="transaction-company">{transaction.company}</h4>
        <p className="transaction-type">{transaction.type}</p>
      </div>
    </div>

    <div className="transaction-right">
      <span className="transaction-amount">{transaction.amount}</span>
      <span
        className="transaction-status"
        style={{
          color:
            transaction.status === 'Completed'
              ? '#16a34a'
              : transaction.status === 'Failed'
              ? '#dc2626'
              : '#f59e0b',
          backgroundColor:
            transaction.status === 'Completed'
              ? '#dcfce7'
              : transaction.status === 'Failed'
              ? '#fca5a5'
              : '#fef3c7'
        }}
      >
        {transaction.status}
      </span>
    </div>
  </article>
);

export default TransactionItem;
