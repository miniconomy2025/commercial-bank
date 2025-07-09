import { Router } from 'express';
import { createTransaction, getAllTransactions, getTransactionById } from '../queries/transactions.queries';
import { logger } from '../utils/logger';
import { getSimTime } from '../utils/time';

const router = Router()

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

  const createdAt = getSimTime();
  const { to_account_number, to_bank_name, amount, description } = req.body;

  const from_account_number = req.account!.accountNumber;
  
  try {
    const newTransaction = await createTransaction(
        to_account_number,
        from_account_number,
        amount,
        description,
        to_bank_name,
        createdAt
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
