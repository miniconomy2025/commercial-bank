import './AccountFilter.css';
import type {  Account } from '../../types/Accounts';

interface AccountFilterProps {
  selectedAccounts: string[];
  handleAccountToggle: (id: string) => void;
  accounts: Account[];
}

const AccountFilter: React.FC<AccountFilterProps> = ({ selectedAccounts, handleAccountToggle, accounts }) => (
  <div className="account-filter-container">
    <h3 className="account-filter-title">Filter Accounts</h3>
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

export default AccountFilter;
