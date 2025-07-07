export type Account =  {
  id: string;
  name: string;
  color: string;
}

export type AccountFilterProps = {
  selectedAccounts: string[];
  handleAccountToggle: (id: string) => void;
  accounts: Account[];
}
