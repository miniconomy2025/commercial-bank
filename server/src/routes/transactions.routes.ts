import { Router, Request, Response } from 'express';
import { createTransaction, getAllTransactions, getTransactionById } from '../queries/transactions.queries';
import { logger } from '../utils/logger';
import { HttpClient } from '../utils/http-client';
import { Account } from '../types/account.type';
import { getAccountFromOrganizationUnit } from '../queries/auth.queries';
import { getAccountInformation, getAccountNotificationUrl } from '../queries/accounts.queries';
import appConfig from '../config/app.config';
import {
  Post_Transaction_Req,
  Post_Transaction_Res,
  Get_Transaction_Req,
  Get_Transaction_Res,
  Get_TransactionNumber_Res
} from '../types/endpoint.types';

const router = Router()

//=============== /transaction ==============//

const httpClient = new HttpClient();

router.get("/", async (req: Request<{}, {}, Get_Transaction_Req>, res: Response<Get_Transaction_Res>) => {
  try {
    const from = req.account!.accountNumber;
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
  const from_account_number = req.account!.accountNumber;
  if (from_account_number  === to_account_number){
    res.status(400).json({ success: false, error: "invalidPayload" });
    return;
  }

  if (amount <= 0) {
    res.status(400).json({ success: false, error: "invalidPayload" }); return;
  }

  if (!to_account_number || !to_bank_name || !description) {
    res.status(400).json({ success: false, error: "invalidPayload" }); return;
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
        'thoh'
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
    if (to_bank_name){
      switch (to_bank_name) {
        case 'thoh': httpClient.post(`${appConfig.thohHost}/orders/payments`, {
          transaction_number: newTransaction.transaction_number,
          status: "SUCCESS",
          amount,
          description
        }).subscribe({
          next: (response) => {
            logger.info("Notification sent successfully:", response);
          },
          error: (error) => {
            logger.info("Error sending notification:", error);
          }
        }); break;
      }
    } else {
      const notificationUrl = await getAccountNotificationUrl(to_account_number);
      if (isValidUrl(notificationUrl)) {
        httpClient.post(notificationUrl!, {
          transaction_number: newTransaction.transaction_number,
          status: "SUCCESS",
          amount,
          description
        }).subscribe({
          next: (response) => {
            logger.info("Notification sent successfully:", response);
          },
          error: (error) => {
            logger.info("Error sending notification:", error);
          }
        });
      }
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
    if (transaction) {
      res.status(200).json({ success: true, transaction });
    } else {
      res.status(404).json({ success: false, error: "transactionNotFound" });
    }
  } catch (error) {
    logger.error("Error fetching transaction:", error);
    res.status(500).json({ success: false, error: "internalError" });
  }
});

export default router;
