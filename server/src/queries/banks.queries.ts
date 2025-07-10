import db from "../config/db.config";
import { SimTime } from "../utils/time";
import { createTransaction } from "./transactions.queries";


export const getBanks = async (): Promise<Bank[]> => {
  return await db.many('SELECT id, name FROM banks');
};


export const interbankTransfer = async (
  transactionNumber: string,
  fromBankTeamId: string,
  fromAccountNumber: string,
  toAccountNumber: string,
  amount: number,
  description: string
): Promise<BankTransferResponse> => {
  // Validate amount
  if (amount <= 0) return { success: false, error: "invalid_amount" };

  // Validate recipient account exists
  const recipientAccountExists = await db.oneOrNone(
    'SELECT 1 FROM account_refs WHERE account_number = $1',
    [toAccountNumber]
  );
  if (!recipientAccountExists) return { success: false, error: "unknown_recipient_account" };

  // Check duplicate transaction number
  const duplicateTransaction = await db.oneOrNone(
    'SELECT 1 FROM transactions WHERE transaction_number = $1',
    [transactionNumber]
  );
  if (duplicateTransaction) return { success: false, error: "transaction_number_already_exists" };

  // Perform the transfer
  const result = await createTransaction(
    toAccountNumber,    // recipient_account_number: string,
    fromAccountNumber,  // sender_account_number: string,
    amount,             // amount: number,
    description,        // description: string,
    fromBankTeamId,     // sender_bank_name: string = 'commercial-bank',
    "commercial-bank",  // recipient_bank_name: string = 'commercial-bank',
    transactionNumber   // transactionNumber?: string
  );

  return { success: true };
};

export type Bank = {
    id: number;   
    name: string;
};

export type BankTransferResponse = { success: true } | { success: false; error: string };


// invalid_amount
// unknown_recipient_amount
// transaction_number_already_exists