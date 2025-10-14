import { Request, Response, Router } from 'express';
import { performInterbankTransfer } from '../queries/interbank.queries';
import { Post_InterbankTransfer_Req, Post_InterbankTransfer_Res } from '../types/endpoint.types';
import db from '../config/db.config';

//=============== /interbank ==============//

const router = Router();

// Send money to us from another bank
router.post("/transfer", async (req: Request<{}, {}, Post_InterbankTransfer_Req>, res: Response<Post_InterbankTransfer_Res>) => {
  if (req.teamId !== 'retail-bank') {
    res.status(403).json({ success: false, error: "transferNotPermitted" });
    return;
  }
  const { transaction_number, from_account_number, to_account_number, amount, description } = req.body;

  // Validation: required fields
  if (!transaction_number || !from_account_number || !to_account_number || !amount || !description) {
    res.status(400).json({ success: false, error: "invalidPayload" });
    return;
  }
  // Validation: amount > 0
  if (typeof amount !== 'number' || amount <= 0) {
    res.status(400).json({ success: false, error: "invalidPayload" });
    return;
  }
  // Validation: description length <= 128
  if (typeof description !== 'string' || description.length > 128) {
    res.status(400).json({ success: false, error: "invalidPayload" });
    return;
  }
  // Validation: to_account_number is a valid existing account
  const accountExists = await db.oneOrNone('SELECT 1 FROM accounts WHERE account_number = $1', [to_account_number]);
  if (!accountExists) {
    res.status(404).json({ success: false, error: "unknownRecipientAccount" });
    return;
  }
  // Validation: transaction_number must not already exist
  const txnExists = await db.oneOrNone('SELECT 1 FROM transactions WHERE transaction_number = $1', [transaction_number]);
  if (txnExists) {
    res.status(409).json({ success: false, error: "duplicateTransactionNumber" });
    return;
  }

  try {
    const result = await performInterbankTransfer(
      transaction_number,
      from_account_number,
      to_account_number,
      amount,
      description
    );
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
