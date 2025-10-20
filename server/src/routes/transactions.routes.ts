import { Router, Request, Response } from 'express';
import { fetchTransactions, createNewTransaction, fetchTransactionById } from '../services/transactions.service';
import db from '../config/db.config';
import { logger } from '../utils/logger';

const router = Router()

router.get("/", async (req: Request, res: Response) => {
  try {
    const from = req.account!.account_number;
    const to = (req.query.to as string);
    const onlySuccessful = req.query.onlySuccessful === 'true';
    const transactions = await fetchTransactions({ from, to, onlySuccessful });
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

router.post("/", async (req: Request, res: Response) => {
  const { to_account_number, amount, description, to_bank_name } = req.body;
  const from_account_number = req.account!.account_number;

  if (typeof amount !== 'number' || amount <= 0)
    { res.status(400).json({ success: false, error: "invalidPayload" }); return; }

  if (typeof description !== 'string' || description.length > 128)
    { res.status(400).json({ success: false, error: "invalidPayload" }); return; }

  if (from_account_number === to_account_number)
    { res.status(400).json({ success: false, error: "invalidPayload" }); return; }

  if (!/^\d{12}$/.test(from_account_number) || !/^\d{12}$/.test(to_account_number)) {
    res.status(400).json({ success: false, error: "invalidPayload" });
    return;
  }

  const validBanks = ["commercial-bank", "thoh"];
  if (!validBanks.includes(to_bank_name))
    { res.status(400).json({ success: false, error: "invalidPayload" }); return; }

  if ([to_account_number, to_bank_name, description].some((field: any) => field == null))
    { res.status(400).json({ success: false, error: "invalidPayload" }); return; }

  const accountStatus = await db.oneOrNone('SELECT is_account_frozen($1) AS frozen, get_account_balance($1) AS balance', [from_account_number]);
  if (!accountStatus)                 { res.status(404).json({ success: false, error: "accountNotFound"   }); return; }
  if (accountStatus.frozen)           { res.status(422).json({ success: false, error: "accountFrozen"     }); return; }
  if (accountStatus.balance < amount) { res.status(422).json({ success: false, error: "insufficientFunds" }); return; }

  if (to_bank_name === "commercial-bank") {
    const recipientExists = await db.oneOrNone('SELECT 1 FROM accounts WHERE account_number = $1', [to_account_number]);
    if (!recipientExists) {
      res.status(404).json({ success: false, error: "accountNotFound" }); return;
    }
  }

  try {
    const newTransaction = await createNewTransaction({
      to_account_number,
      amount,
      description,
      to_bank_name,
      from_account_number,
    });
    if (!newTransaction) {
      res.status(400).json({ success: false, error: "invalidPayload" });
      return;
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

router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const transaction = await fetchTransactionById(id);
    if (transaction == null) {
      res.status(404).json({ success: false, error: "transactionNotFound" });
      return;
    }
    res.status(200).json({ success: true, transaction });
  } catch (error) {
    logger.error("Error fetching transaction:", error);
    res.status(500).json({ success: false, error: "internalError" });
  }
});

export default router;
