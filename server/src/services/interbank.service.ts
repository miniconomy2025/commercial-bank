import { performInterbankTransfer } from '../queries/interbank.queries';
import db from '../config/db.config';

export async function performTransfer(params: {
  transaction_number: string;
  from_account_number: string;
  to_account_number: string;
  amount: number;
  description: string;
}) {
  const { transaction_number, from_account_number, to_account_number, amount, description } = params;
  const result = await performInterbankTransfer(
    transaction_number,
    from_account_number,
    to_account_number,
    amount,
    description
  );
  return result;
}


