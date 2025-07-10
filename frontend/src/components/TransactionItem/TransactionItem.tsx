import React from 'react';
import './TransactionItem.css';
import type { Transaction } from '../../types/Transaction';



interface TransactionItemProps {
  transaction: Transaction;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction }) => (
  <article className="transaction-item">
    <div className="transaction-left">
      <div className="transaction-info">
        <h4 className="transaction-company">{transaction.to}</h4>
        <p className="transaction-type">{transaction.from}</p>
        <p className="transaction-type">{transaction.description}{transaction.date}</p>
      </div>
    </div>

    <div className="transaction-right">
      <span className="transaction-amount">{transaction.amount}</span>
      <span
        className="transaction-status"
        style={{
          color:
            transaction.status === 'success'
              ? '#16a34a'
              : '#dc2626',
          backgroundColor:
            transaction.status === 'success'
              ? '#dcfce7'
              :'#fca5a5'
             
        }}
      >
        {transaction.status}
      </span>
    </div>
  </article>
);

export default TransactionItem;
