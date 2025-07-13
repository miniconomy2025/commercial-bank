export interface Transaction {

  transaction_number: string;
  from: string;
  to: string;
  amount: number;
  description: string;
  status: string;
  timestamp: SimTime
};

export type SimTime = number;
