import { Router, Request, Response } from 'express';
import { createTransaction, getAllTransactions, getTransactionById } from '../queries/transactions.queries';
import { logger } from '../utils/logger';
import { HttpClient } from '../utils/http-client';
import { getAccountNotificationUrl } from '../queries/accounts.queries';
import appConfig from '../config/app.config';
import {
  Post_Transaction_Req,
  Post_Transaction_Res,
  Get_Transaction_Req,
  Get_Transaction_Res,
  Get_TransactionNumber_Res
} from '../types/endpoint.types';
import db from '../config/db.config';

const router = Router()

//=============== /transaction ==============//

const httpClient = new HttpClient();

router.get("/", async (req: Request<{}, {}, Get_Transaction_Req>, res: Response<Get_Transaction_Res>) => {
  try {
    const from = req.account!.account_number;
    const to = (req.query.to as string);
    const onlySuccessful = req.query.onlySuccessful === 'true';
    const transactions = await getAllTransactions(from, to, onlySuccessful);
    res.status(200).json({ success: true, transactions });
  } catch (error) {
    logger.error("Error fetching transactions:", error);
    res.status(500).json({ success: false, error: "internalError" });
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

router.post("/", async (req: Request<{}, {}, Post_Transaction_Req>, res: Response<Post_Transaction_Res>) => {
  const { to_account_number, amount, description, to_bank_name } = req.body;
  const from_account_number = req.account!.account_number;

  // Validation: amount > 0
  if (typeof amount !== 'number' || amount <= 0)
    { res.status(400).json({ success: false, error: "invalidPayload" }); return; }

  // Validation: description length <= 128
  if (typeof description !== 'string' || description.length > 128)
    { res.status(400).json({ success: false, error: "invalidPayload" }); return; }

  // Validation: to_account_number cannot be your own account
  if (from_account_number === to_account_number)
    { res.status(400).json({ success: false, error: "invalidPayload" }); return; }

  if (!/^\d{12}$/.test(from_account_number) || !/^\d{12}$/.test(to_account_number)) {
    res.status(400).json({ success: false, error: "invalidPayload" });
    return;
  }

  // Validation: to_bank_name must be valid
  const validBanks = ["commercial-bank", "thoh"]; // NOTE: "retail-bank" should never be a recipient
  if (!validBanks.includes(to_bank_name))
    { res.status(400).json({ success: false, error: "invalidPayload" }); return; }

  // Validation: required fields
  if ([to_account_number, to_bank_name, description].some(field => field == null))
    { res.status(400).json({ success: false, error: "invalidPayload" }); return; }

  // Validation: sufficient funds and frozen status
  const accountStatus = await db.oneOrNone('SELECT is_account_frozen($1) AS frozen, get_account_balance($1) AS balance', [from_account_number]);
  if (!accountStatus)                 { res.status(404).json({ success: false, error: "accountNotFound"   }); return; }
  if (accountStatus.frozen)           { res.status(422).json({ success: false, error: "accountFrozen"     }); return; }
  if (accountStatus.balance < amount) { res.status(422).json({ success: false, error: "insufficientFunds" }); return; }

  // Validation: if to_bank_name is commercial-bank, check account exists
  if (to_bank_name === "commercial-bank") {
    const recipientExists = await db.oneOrNone('SELECT 1 FROM accounts WHERE account_number = $1', [to_account_number]);
    if (!recipientExists) {
      res.status(404).json({ success: false, error: "accountNotFound" }); return;
    }
  }

  try {
    let newTransaction;
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
      res.status(400).json({ success: false, error: "invalidPayload" });
      return;
    }

    const notificationPayload = {
      transaction_number: newTransaction.transaction_number,
      status: newTransaction.status,
      amount,
      timestamp: newTransaction.timestamp, // simulation time, replace with getSimTime() if available
      description,
      from: from_account_number,
      to: to_account_number
    };

    switch(to_bank_name) {
      case 'thoh':
        // Interbank notification
        httpClient.post(`${appConfig.thohHost}/orders/payments`, notificationPayload).subscribe({
          next: (response) => { console.log("Notification sent successfully:", response); },
          error: (error) =>   { console.log("Error sending notification:", error); }
        });
        // TODO: Correctly handle THOH response - If THOH returns an error, we should rollback the transaction
      break;

      case 'commercial-bank':
        // Send notification
        const notificationUrl = await getAccountNotificationUrl(to_account_number);

        if (appConfig.isProd && notificationUrl != null && isValidUrl(notificationUrl)) {
          httpClient.post(notificationUrl!, notificationPayload).subscribe({
            next: (response) => { logger.info("Notification sent successfully:", response); },
            error: (error) => { logger.info("Error sending notification:", error); }
          });
        }
      break;

      case 'retail-bank': /* NOOP: Retail bank should never be sent money */ break;
    }

    res.status(200).json({
      success: true,
      transaction_number: newTransaction.transaction_number,
      status: newTransaction.status
    });
  } catch (error) {
    console.log("Error creating transaction:", error);
    res.status(500).json({ success: false, error: "internalError" });
  }
});

router.get("/:id", async (req, res: Response<Get_TransactionNumber_Res>) => {
  const { id } = req.params;

  try {
    const transaction = await getTransactionById(id);

    if (transaction == null)
      { res.status(404).json({ success: false, error: "transactionNotFound" }); return; }

    res.status(200).json({ success: true, transaction });
  }
  catch (error) {
    logger.error("Error fetching transaction:", error);
    res.status(500).json({ success: false, error: "internalError" });
  }
});

export default router;
