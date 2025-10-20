import { Request, Response, Router } from 'express';
import { performTransfer } from '../services/interbank.service';
import db from '../config/db.config';

//=============== /interbank ==============//

const router = Router();

router.post("/transfer", async (req: Request, res: Response) => {
  if (req.teamId !== 'retail-bank') {
    res.status(403).json({ success: false, error: "transferNotPermitted" });
    return;
  }
  const { transaction_number, from_account_number, to_account_number, amount, description } = req.body;

  if (!transaction_number || !from_account_number || !to_account_number || !amount || !description) {
    res.status(400).json({ success: false, error: "invalidPayload" });
    return;
  }
  if (typeof amount !== 'number' || amount <= 0) {
    res.status(400).json({ success: false, error: "invalidPayload" });
    return;
  }
  if (typeof description !== 'string' || description.length > 128) {
    res.status(400).json({ success: false, error: "invalidPayload" });
    return;
  }
  const accountExists = await db.oneOrNone('SELECT 1 FROM accounts WHERE account_number = $1', [to_account_number]);
  if (!accountExists) {
    res.status(404).json({ success: false, error: "unknownRecipientAccount" });
    return;
  }
  const txnExists = await db.oneOrNone('SELECT 1 FROM transactions WHERE transaction_number = $1', [transaction_number]);
  if (txnExists) {
    res.status(409).json({ success: false, error: "duplicateTransactionNumber" });
    return;
  }

  try {
    const result = await performTransfer({
      transaction_number,
      from_account_number,
      to_account_number,
      amount,
      description
    });
    if (result.success) {
      res.status(200).json({ success: true });
    } else {
      res.status(422).json({ success: false, error: "transferNotPermitted" });
    }
  }
  catch (error) {
    console.error("Error processing interbank transfer:", error);
    res.status(500).json({ success: false, error: "internalError" });
  }
});

export default router;
