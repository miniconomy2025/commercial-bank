export type Account =  {
  account_number: string;
  id: string;
  name: string;
  color: string;
  balance:string
  income:string
  expenses:string
  loanBalance:string
}

export type AccountFilterProps = {
  selectedAccounts: string[];
  handleAccountToggle: (id: string) => void;
  accounts: Account[];
}
