import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import AccountFilter from '../components/AccountFilter/AccountFilter';
import type { Account } from '../types/Accounts';

const mockAccounts: Account[] = [
  { id: '1', name: 'Checking', color: '#blue', account_number: '123', balance: '1000', income: '500', expenses: '200', loanBalance: '0' },
  { id: '2', name: 'Savings', color: '#green', account_number: '456', balance: '2000', income: '300', expenses: '100', loanBalance: '0' }
];

describe('AccountFilter', () => {
  it('filters accounts correctly', () => {
    const mockToggle = vi.fn();
    render(<AccountFilter selectedAccounts={['1']} handleAccountToggle={mockToggle} accounts={mockAccounts} />);
    
    expect(screen.getByLabelText('Checking')).toBeChecked();
    expect(screen.getByLabelText('Savings')).not.toBeChecked();
  });

  it('handles search functionality', () => {
    const mockToggle = vi.fn();
    render(<AccountFilter selectedAccounts={[]} handleAccountToggle={mockToggle} accounts={mockAccounts} />);
    
    fireEvent.click(screen.getByLabelText(/Checking/));
    expect(mockToggle).toHaveBeenCalledWith('1');
  });
});