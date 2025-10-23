import './AccountFilter.css';
import type {  Account } from '../../types/Accounts';

interface AccountFilterProps {
  selectedAccounts: string[];
  handleAccountToggle: (id: string) => void;
  accounts: Account[];
}

const AccountFilter: React.FC<AccountFilterProps> = ({ selectedAccounts, handleAccountToggle, accounts }) => {
  // Create a set of unique account IDs to handle potential duplicates
  const uniqueAccountIds = new Set(accounts.map(account => account.id));
  const allSelected = uniqueAccountIds.size > 0 && selectedAccounts.length === uniqueAccountIds.size;
  
  const handleSelectAll = () => {
    if (allSelected) {
      // Deselect all
      selectedAccounts.forEach(id => handleAccountToggle(id));
    } else {
      // Select all unselected accounts
      Array.from(uniqueAccountIds).forEach(accountId => {
        if (!selectedAccounts.includes(accountId)) {
          handleAccountToggle(accountId);
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
        {accounts
          .filter((account, index, self) => 
            index === self.findIndex(a => a.id === account.id)
          )
          .map(account => (
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
          ))
        }
      </div>
    </div>
  );
};

export default AccountFilter;
