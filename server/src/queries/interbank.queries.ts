import db from "../config/db.config";
import { createTransaction } from "./transactions.queries";

export const performInterbankTransfer = async (
    transaction_number: string,
    from_account_number: string,
    to_account_number: string,
    amount: number,
    description: string,
): Promise<InterbankTransferResult> => {
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
        return { success: false, error: "existingTransactionNumber" };
    }

    // Insert transaction using createTransaction
    await createTransaction(
        to_account_number,
        from_account_number,
        amount,
        description,
        'retail-bank', // sender_bank_name
        'commercial-bank', // recipient_bank_name
        transaction_number
    );

    return { success: true, message: "Transfer recorded successfully" };
}

export type InterbankTransferError = "unknownRecipientAccount" | "existingTransactionNumber" | "invalidAmount";

export type InterbankTransferResult = (
    { success: true, message: "Transfer recorded successfully" } |
    { success: false, error: InterbankTransferError }
)