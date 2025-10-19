import db from "../config/db.config";
import { createTransaction } from "./transactions.queries";
import { sendNotification } from '../utils/notification';
import { Post_InterbankTransfer_Res, SimpleResult } from "../types/endpoint.types";

export const performInterbankTransfer = async (
    transaction_number: string,
    from_account_number: string,
    to_account_number: string,
    amount: number,
    description: string,
    from_bank_name: string = 'retail-bank'
): Promise<Post_InterbankTransfer_Res> => {
    // Validate this is only for external banks sending TO commercial-bank
    if (from_bank_name === 'commercial-bank') {
        return { success: false, error: "invalidSenderBank" };
    }

    // Validate amount
    if (amount <= 0) { return { success: false, error: "invalidAmount" }; }

    // Check recipient account exists
    const recipientAccount = await db.oneOrNone(
        'SELECT 1 FROM account_refs WHERE account_number = $1',
        [to_account_number]
    );
    if (!recipientAccount) {
        return { success: false, error: "unknownRecipientAccount" };
    }

    // Check for duplicate transaction number
    const duplicateTransaction = await db.oneOrNone(
        'SELECT 1 FROM transactions WHERE transaction_number = $1',
        [transaction_number]
    );
    if (duplicateTransaction) {
        return { success: false, error: "duplicateTransactionNumber" };
    }

    // Note: No sender balance validation - external banks handle their own validation

    // Insert transaction using createTransaction
    const transaction = await createTransaction(
        to_account_number,
        from_account_number,
        amount,
        description,
        from_bank_name, // sender_bank_name
        'commercial-bank', // recipient_bank_name
        transaction_number
    );

    // Send notification to recipient
    await sendNotification(to_account_number, {
      transaction_number: transaction.transaction_number,
      status: transaction.status || 'success',
      amount: amount,
      timestamp: Date.now(),
      description,
      from: from_account_number,
      to: to_account_number
    });

    return { success: true };
}