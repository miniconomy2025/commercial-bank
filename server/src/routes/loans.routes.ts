import { Router } from 'express';
import { createTransaction, getAllTransactions, getTransactionById } from '../queries/transactions.queries';
import { createLoan, getLoanDetails, getLoanSummariesForAccount, repayLoan, setLoanInterestRate } from '../queries/loans.queries';
import { logger } from '../utils/logger';
import { accountMiddleware } from '../middlewares/auth.middleware';

const router = Router()

router.use(accountMiddleware);
// Take out a loan
router.post("/loan", async (req, res) => {
  const { amount } = req.body;
  const borrowerAccNo = req.account!.accountNumber;
  try {
    const loanResult = await createLoan(borrowerAccNo, amount);
    res.status(200).json(loanResult);
  }
  catch (error) {
    logger.error("Error creating loan:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// List all loans for the account
// NOTE: Only the original borrower can get details for their loan
router.get("/loan", async (req, res) => {
  const accNo = req.account!.accountNumber;

  try {
    const loanSummaries = await getLoanSummariesForAccount(accNo);
    res.status(200).json(loanSummaries);
  }
  catch (error) {
    logger.error(`Error getting loans for account ${accNo}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Repay loan
// NOTE: Any account can contribute to the repayment of a loan on any other account
router.post("/loan/:loan_number/pay", async (req, res) => {
  const { amount } = req.body;
  const { loan_number } = req.params;

  const accNo = req.account!.accountNumber;

  try {
    const repayment = await repayLoan(loan_number, accNo, amount);
    res.status(200).json(repayment);
  }
  catch (error) {
    logger.error("Error repaying loan:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Get specific loan details
// NOTE: Only the account which took out the loan can get loan details
router.get("/loan/:loan_number", async (req, res) => {
  const { loan_number } = req.params;
  const accNo = req.account!.accountNumber;

  try {
    const loanDetails = await getLoanDetails(loan_number, accNo);
    res.status(200).json(loanDetails);
  }
  catch (error) {
    logger.error("Error getting loan details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//update the prime rate
//NOTE: oly the hand can update this
router.post("loan/prime_rate",async (req,res) =>{
  const teamId = req.teamId
  const {prime_rate} = req.body;
  if (teamId!=="thoh"){
    res.status(400).json("Only the hand can change the prime rate");
  } else {
    setLoanInterestRate(Number(prime_rate));
    res.status(200).json({ status: "Prime rate updated successfully" ,prime_rate: prime_rate });
  }
});


export default router;
