export interface Transaction {

  transaction_number: string;
  from: string;
  to: string;
  amount: number;
  description: string;
  status: string;
  date: SimTime
};

export type SimTime = number;
