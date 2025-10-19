import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import AccountSelector from '../AccountSelector';
import type { Account } from '../../../types/Accounts';

const mockAccounts: Account[] = [
  { id: '1', name: 'Checking', color: '#blue', account_number: '123', balance: '1000', income: '500', expenses: '200', loanBalance: '0' },
  { id: '2', name: 'Savings', color: '#green', account_number: '456', balance: '2000', income: '300', expenses: '100', loanBalance: '0' }
];

describe('AccountSelector', () => {
  it('manages selection state correctly', () => {
    const mockSelect = vi.fn();
    render(<AccountSelector accounts={mockAccounts} selectedAccounts={['1']} onAccountSelect={mockSelect} />);
    
    const checkingButton = screen.getByText('Checking');
    expect(checkingButton).toHaveClass('selected');
    expect(screen.getByText('Savings')).not.toHaveClass('selected');
  });

  it('validates selection changes', () => {
    const mockSelect = vi.fn();
    render(<AccountSelector accounts={mockAccounts} selectedAccounts={[]} onAccountSelect={mockSelect} />);
    
    fireEvent.click(screen.getByText('Savings'));
    expect(mockSelect).toHaveBeenCalledWith(['2']);
  });
});