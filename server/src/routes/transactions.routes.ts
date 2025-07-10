import { Router } from 'express';
import { createTransaction, getAllTransactions, getTransactionById } from '../queries/transactions.queries';
import { logger } from '../utils/logger';
import { accountMiddleware } from '../middlewares/auth.middleware';

const router = Router()

const banks = {
  commercial: 'commercial-bank',
  retail: 'retail-bank',
  hand: 'THOH'
}

router.get("/transactions", async (req, res) => {
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

router.post("/transactions", async (req, res) => {

  const { to_account_number, to_bank_name, amount, description } = req.body;
  const from_account_number = req.account!.accountNumber;

  // Check if interbank transfer is needed
  if (to_bank_name !== "commercial-bank") {
    switch (to_bank_name) {
      case "thoh":
        // TODO: Call THOH /interbank/transfer endpoint
        break;
      default:
        logger.warn(`Interbank transfer to ${to_bank_name} is not implemented yet.`);
        res.status(400).json({ error: `Interbank transfer to ${to_bank_name} is not supported.` });
        return;
    }
  }

  try {

    switch(to_bank_name.toLowerCase()) {
    case banks.hand:
      const interHand = await fetch(
        `${process.env.THOH_HOST}/api/interbank`, 
        { method: 'POST', body: JSON.stringify({ to_account_number, to_bank_name, amount, description, from_account_number }) })
      res.status(200).json(interHand);
  }
    const newTransaction = await createTransaction(
        to_account_number,
        from_account_number,
        amount,
        description
    );
    res.status(200).json(newTransaction);
  } catch (error) {
    logger.error("Error creating transaction:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/transactions/:id", async (req, res) => {
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
