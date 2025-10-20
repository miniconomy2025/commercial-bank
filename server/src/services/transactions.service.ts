import { createTransaction, getAllTransactions, getTransactionById } from '../queries/transactions.queries';
import { logger } from '../utils/logger';
import { HttpClient } from '../utils/http-client';
import { getAccountNotificationUrl } from '../queries/accounts.queries';
import appConfig from '../config/app.config';
import db from '../config/db.config';

const httpClient = new HttpClient();

export async function fetchTransactions(params: { from: string; to?: string; onlySuccessful?: boolean }) {
  const transactions = await getAllTransactions(params.from, params.to ?? '', Boolean(params.onlySuccessful));
  return transactions;
}

function isValidUrl(urlString?: string): boolean {
  try {
    if (!urlString) return false;
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}

export async function createNewTransaction(params: {
  to_account_number: string;
  amount: number;
  description: string;
  to_bank_name: string;
  from_account_number: string;
}) {
  let newTransaction;
  const { to_account_number, amount, description, to_bank_name, from_account_number } = params;
  if (to_bank_name) {
    newTransaction = await createTransaction(
      to_account_number,
      from_account_number,
      amount,
      description,
      'commercial-bank',
      to_bank_name
    );
  } else {
    newTransaction = await createTransaction(
      to_account_number,
      from_account_number,
      amount,
      description
    );
  }
  if (!newTransaction) {
    return null;
  }
  const notificationPayload = {
    transaction_number: newTransaction.transaction_number,
    status: newTransaction.status,
    amount,
    timestamp: newTransaction.timestamp,
    description,
    from: from_account_number,
    to: to_account_number
  };
  switch (to_bank_name) {
    case 'thoh':
      httpClient.post(`${appConfig.thohHost}/orders/payments`, notificationPayload).subscribe({
        next: (response) => { console.log("Notification sent successfully:", response); },
        error: (error) => { console.log("Error sending notification:", error); }
      });
      break;
    case 'commercial-bank':
      const notificationUrl = await getAccountNotificationUrl(to_account_number);
      if (appConfig.isProd && notificationUrl != null && isValidUrl(notificationUrl)) {
        httpClient.post(notificationUrl!, notificationPayload).subscribe({
          next: (response) => { logger.info("Notification sent successfully:", response); },
          error: (error) => { logger.info("Error sending notification:", error); }
        });
      }
      break;
    case 'retail-bank':
      break;
  }
  return newTransaction;
}

export async function fetchTransactionById(id: string) {
  const transaction = await getTransactionById(id);
  return transaction;
}


