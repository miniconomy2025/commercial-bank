import { render, screen } from '@testing-library/react';
import TransactionItem from '../components/TransactionItem/TransactionItem';
import type { Transaction } from '../types/Transaction';

const mockTransaction: Transaction = {
  transaction_number: '123',
  from: 'Account A',
  to: 'Account B',
  amount: 1500.75,
  description: 'Test payment',
  status: 'success',
  timestamp: 1640995200
};

describe('TransactionItem', () => {
  it('formats amount correctly', () => {
    render(<TransactionItem transaction={mockTransaction} />);
    expect(screen.getByText('1500.75')).toBeInTheDocument();
  });

  it('calculates date display', () => {
    render(<TransactionItem transaction={mockTransaction} />);
    expect(screen.getByText(/1640995200/)).toBeInTheDocument();
  });

  it('applies status styling', () => {
    render(<TransactionItem transaction={mockTransaction} />);
    const statusElement = screen.getByText('success');
    expect(statusElement).toHaveStyle({ color: '#16a34a' });
  });
});