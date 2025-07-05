export interface Transaction {
id?:string | number
  icon?: React.ReactNode;
  iconBg?: string;
  company?: string;
  type?: string;
  amount?: string | number;
  status?: 'Completed' | 'Failed' | 'Pending' | string;
}