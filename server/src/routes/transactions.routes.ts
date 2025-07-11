import { Router } from 'express';
import { createTransaction, getAllTransactions, getTransactionById } from '../queries/transactions.queries';
import { logger } from '../utils/logger';
import { HttpClient } from '../utils/http-client';
import { Account } from '../types/account.type';
import { getAccountFromOrganizationUnit } from '../queries/auth.queries';
import { getAccountInformation, getAccountNotificationUrl } from '../queries/accounts.queries';

const router = Router()

const httpClient = new HttpClient();

router.get("/", async (req, res) => {
  try {
    const from = req.account!.accountNumber;
    const to = (req.query.to as string);
    const onlySuccessful = req.query.onlySuccessful === 'true';
    const transactions = await getAllTransactions(from, to, onlySuccessful);
    res.status(200).json(transactions);
  } catch (error) {
    logger.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

function isValidUrl(urlString?: string): boolean {
  try {
    if (!urlString) return false;
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}


router.post("/", async (req, res) => {
  const { to_account_number, amount, description } = req.body;
  const from_account_number = req.account!.accountNumber;
  if (from_account_number  === to_account_number){
    res.status(400).json({ error: "Cant send money to yourself" });
    return;
  }

  try {
    const newTransaction = await createTransaction(
      to_account_number,
      from_account_number,
      amount,
      description
    );
    if (!newTransaction) {
      res.status(400).json({ error: "Invalid transaction data" });
      return;
    }
    const notificationUrl = await getAccountNotificationUrl(to_account_number);
    if (isValidUrl(notificationUrl)) {
      httpClient.post(notificationUrl!, {
        transaction_number: newTransaction.transaction_number,
        status: "SUCCESS",
        amount,
        description
      }).subscribe({
        next: (response) => {
          console.log("Notification sent successfully:", response);
        },
        error: (error) => {
          console.log("Error sending notification:", error);
        }
      });
    }
    res.status(200).json(newTransaction);
  } catch (error) {
    console.log("Error creating transaction:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const transaction = await getTransactionById(id);
    if (transaction) {
      res.status(200).json(transaction);
    } else {
      res.status(404).json({error: "Transaction not found"});
    }
  } catch (error) {
    logger.error("Error fetching transaction:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
