import { Router } from 'express';
import { performInterbankTransfer } from '../queries/interbank.queries';

const router = Router()

// Send money to us from another bank
router.post("/transfer", async (req, res) => {
  if (req.teamId !== 'retail-bank') {
    res.status(403).json({ error: "Forbidden: Only retail bank can perform interbank transfers" });
    return;
  }
  const { transaction_number, from_account_number, to_account_number, amount, description } = req.body;

  if (!transaction_number || !from_account_number || !to_account_number || !amount || !description) {
    res.status(400).json({ error: 'All fields are required' });
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
      res.status(200).json({ message: result.message });
    } else {
      res.status(400).json({ error: result.error });
    }
  }
  catch (error) {
    console.error("Error processing interbank transfer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
