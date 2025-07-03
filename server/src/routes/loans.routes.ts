import { Router } from 'express';
import { createTransaction, getAllTransactions, getTransactionById } from '../queries/transactions.queries';
import { createLoan, getLoanDetails, getLoanSummariesForAccount, repayLoan } from '../queries/loans.queries';

const router = Router()


// Take out a loan
router.post("/loan", async (req, res) => {
  const { amount } = req.body;
  const borrowerAccNo = "200012341234"; // TODO: Grab from certificate

  try {
    const loanResult = await createLoan(borrowerAccNo, amount);
    res.status(200).json(loanResult);
  }
  catch (error) {
    console.error("Error creating loan:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// List all loans for the account
// NOTE: Only the original borrower can get details for their loan
router.get("/loan", async (req, res) => {
  const accNo = "200012341234"; // TODO: Grab from certificate

  try {
    const loanSummaries = await getLoanSummariesForAccount(accNo);
    res.status(200).json(loanSummaries);
  }
  catch (error) {
    console.error(`Error getting loans for account ${accNo}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Repay loan
// NOTE: Any account can contribute to the repayment of a loan on any other account
router.post("/loan/:loan_number/pay", async (req, res) => {
  const { amount } = req.body;
  const { loan_number } = req.params;

  const accNo = "200012341234"; // TODO: Grab from certificate

  try {
    const repayment = await repayLoan(loan_number, accNo, amount);
    res.status(200).json(repayment);
  }
  catch (error) {
    console.error("Error repaying loan:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Get specific loan details
// NOTE: Only the account which took out the loan can get loan details
router.get("/loan/:loan_number", async (req, res) => {
  const { loan_number } = req.params;
  const accNo = "200012341234"; // TODO: Grab from certificate

  try {
    const loanDetails = await getLoanDetails(loan_number, accNo);
    res.status(200).json(loanDetails);
  }
  catch (error) {
    console.error("Error getting loan details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


export default router;
