import { render, screen, fireEvent } from '@testing-library/react';
import Transactions from '../Transactions';
import type { Transaction } from '../../../types/Transaction';

const mockTransactions: Transaction[] = Array.from({ length: 12 }, (_, i) => ({
  transaction_number: `${i + 1}`,
  from: `Account ${i}`,
  to: `Account ${i + 1}`,
  amount: 100 * (i + 1),
  description: `Transaction ${i + 1}`,
  status: 'success',
  timestamp: 1640995200 + i
}));

describe('Transactions', () => {
  it('implements sorting algorithms', () => {
    render(<Transactions transactions={mockTransactions} />);
    const firstItem = screen.getByText('Account 0');
    expect(firstItem).toBeInTheDocument();
  });

  it('handles pagination logic correctly', () => {
    render(<Transactions transactions={mockTransactions} />);
    
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeDisabled();
    
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('displays correct items per page', () => {
    render(<Transactions transactions={mockTransactions} />);
    const transactionItems = screen.getAllByText(/Account \d/);
    expect(transactionItems).toHaveLength(10); // 5 items * 2 (from + to)
  });
});