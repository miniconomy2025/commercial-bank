import { getAccountNotificationUrl } from '../queries/accounts.queries';
import { HttpClient } from './http-client';
import { logger } from './logger';

export interface PaymentNotificationPayload {
  transaction_number: string;
  status: string;
  amount: number;
  timestamp: number;
  description: string;
  from: string;
  to: string;
}

export const sendNotification = async (
  toAccountNumber: string,
  payload: PaymentNotificationPayload
): Promise<void> => {
  const notificationUrl = await getAccountNotificationUrl(toAccountNumber);
  if (!notificationUrl) return;
  const httpClient = new HttpClient();
  try {
    httpClient.post(notificationUrl, payload);
    logger.info(`Notification sent to ${toAccountNumber} at ${notificationUrl}`);
  } catch (err) {
    logger.error(`Failed to send notification to ${toAccountNumber}:`, err);
  }
};