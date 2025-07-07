import './AccountSelector.css';
import type { Account } from '../../types/Accounts';


type AccountSelectorProps = {
  accounts: Account[];
  selectedAccounts: string[];
  onAccountSelect: (ids: string[]) => void;
};

const AccountSelector: React.FC<AccountSelectorProps> = ({ accounts, selectedAccounts, onAccountSelect }) => {
  return (
      <div className="account-selector-buttons">
        {accounts.map(account => {
          const isSelected = selectedAccounts.includes(account.id);
          return (
            <button
              key={account.id}
              onClick={() => onAccountSelect([account.id])}
              className={`account-button ${isSelected ? 'selected' : ''}`}
            >
              {account.name}
            </button>
          );
        })}
      </div>
  );
};

export default AccountSelector;
