import './AccountFilter.css';
import type {  Account } from '../../types/Accounts';

interface AccountFilterProps {
  selectedAccounts: string[];
  handleAccountToggle: (id: string) => void;
  accounts: Account[];
}

const AccountFilter: React.FC<AccountFilterProps> = ({ selectedAccounts, handleAccountToggle, accounts }) => {
  const allSelected = accounts.length > 0 && selectedAccounts.length === accounts.length;
  
  const handleSelectAll = () => {
    if (allSelected) {
      // Deselect all
      selectedAccounts.forEach(id => handleAccountToggle(id));
    } else {
      // Select all unselected accounts
      accounts.forEach(account => {
        if (!selectedAccounts.includes(account.id)) {
          handleAccountToggle(account.id);
        }
      });
    }
  };

  return (
    <div className="account-filter-container">
      <h3 className="account-filter-title">Filter Accounts</h3>
      <button 
        onClick={handleSelectAll}
        className="select-all-button"
        style={{
          marginBottom: '0.5rem',
          padding: '0.25rem 0.5rem',
          fontSize: '0.875rem',
          cursor: 'pointer',
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: '#f8f9fa'
        }}
      >
        {allSelected ? 'Deselect All' : 'Select All'}
      </button>
      <div className="account-filter-list">
        {accounts.map(account => (
          <label key={account.id} className="account-filter-label">
            <input
              type="checkbox"
              checked={selectedAccounts.includes(account.id)}
              onChange={() => handleAccountToggle(account.id)}
              style={{
                width: '1rem',
                height: '1rem',
                accentColor: account.color,
                cursor: 'pointer'
              }}
            />

            {account.name}
          </label>
        ))}
      </div>
    </div>
  );
};

export default AccountFilter;
