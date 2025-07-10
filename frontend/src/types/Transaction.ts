export interface Transaction {

  transaction_number: string;
  from: string;
  to: string;
  amount: number;
  description: string;
  status: string;
  time: SimTime
};

export type SimTime = number;
