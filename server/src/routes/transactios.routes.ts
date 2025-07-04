import { Router } from 'express';
import appConfig from "../config/app.config";
import { createTransaction, getAllTransactions, getTransactionById } from '../queries/transactions.queries';
import { timeStamp } from 'console';

const router = Router()

router.get("/transactions", async (req, res) => {
  try {
    const from = (req.query.from as string);
    const to = (req.query.to as string);
    const onlySuccessful = req.query.onlySuccessful === 'true';
    const transactions = await getAllTransactions(from, to, onlySuccessful);
    res.status(200).json(transactions);
  } catch (error) {
    appConfig.isDev? console.error("Error fetching transactions:", error) : null;
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/transactions", async (req, res) => {
    
  const { from_account_number, to_account_number, to_bank_name, amount, description, timeStamp } = req.body;
  try {
    const newTransaction = await createTransaction(
        to_account_number,
        to_bank_name,
        from_account_number,
        amount,
        description,
        timeStamp
    );
    res.status(200).json(newTransaction);
  } catch (error) {
    console.error("Error creating transaction:", error);
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
      res.status(404).json("Transaction not found" );
    }
  } catch (error) {
    console.error("Error fetching transaction:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
