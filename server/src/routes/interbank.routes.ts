import { Router } from 'express';
import { createTransaction, getAllTransactions, getTransactionById } from '../queries/transactions.queries';
import { createLoan, getLoanDetails, getLoanSummariesForAccount, repayLoan } from '../queries/loans.queries';

const router = Router()


// Send money to us from another bank
router.post("/interbank/transfer", async (req, res) => {
  const { amount } = req.body;
  const bankId = "retail-bank"; // TODO: Grab from certificate

  try {
    const loanResult = await createLoan(borrowerAccNo, amount);
    res.status(200).json(loanResult);
  }
  catch (error) {
    console.error("Error creating loan:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
