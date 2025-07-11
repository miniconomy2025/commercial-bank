import { Router, Request, Response } from 'express';
import { createTransaction, getAllTransactions, getTransactionById } from '../queries/transactions.queries';
import { createLoan, getLoanDetails, getLoanSummariesForAccount, repayLoan, setLoanInterestRate } from '../queries/loans.queries';
import { logger } from '../utils/logger';
import { snakeToCamelCaseMapper } from '../utils/mapper';
import {
  Post_Loan_Req,
  Post_Loan_Res,
  Get_Loan_Res,
  Post_LoanNumberPay_Req,
  Post_LoanNumberPay_Res,
  Get_LoanNumber_Res,
  Get_Loan_Req
} from '../types/endpoint.types';

//=============== /loan ==============//

const router = Router()

// Take out a loan
router.post("/", async (req: Request<{}, {}, Post_Loan_Req>, res: Response<Post_Loan_Res>) => {
  const { amount } = req.body;
  const borrowerAccNo = req.account!.accountNumber;
  if (!amount || isNaN(amount) || amount <= 0) {
    res.status(400).json({ success: false, error: "invalidPayload" });
    return;
  }
  try {
    const loanResult = await createLoan(borrowerAccNo, amount);
    res.status(200).json(loanResult);
  }
  catch (error) {
    logger.error("Error creating loan:", error);
    res.status(500).json({ success: false, error: "internalError" });
  }
});


// List all loans for the account
// NOTE: Only the original borrower can get details for their loan
router.get("/", async (req: Request<{}, {}, Get_Loan_Req>, res: Response<Get_Loan_Res>) => {
  const accNo = req.account!.accountNumber;

  try {
    const loanSummaries = await getLoanSummariesForAccount(accNo);
    res.status(200).json({ success: true, total_outstanding_amount: loanSummaries.reduce((sum, l) => sum + l.outstanding_amount, 0), loans: loanSummaries });
  }
  catch (error) {
    logger.error(`Error getting loans for account ${accNo}:`, error);
    res.status(500).json({ success: false, error: "internalError" });
  }
});


// Repay loan
// NOTE: Any account can contribute to the repayment of a loan on any other account
router.post("/:loan_number/pay", async (req: Request<{ loan_number: string }, {}, Post_LoanNumberPay_Req>, res: Response<Post_LoanNumberPay_Res>) => {
  const { amount } = req.body;
  if (!amount || isNaN(amount) || amount <= 0) {
    res.status(400).json({ success: false, error: "invalidPayload" });
    return;
  }
  const { loan_number } = req.params;
  const accNo = req.account!.accountNumber;

  try {
    const repayment = await repayLoan(loan_number, accNo, amount);
    res.status(200).json(repayment);
  }
  catch (error) {
    logger.error("Error repaying loan:", error);
    res.status(500).json({ success: false, error: "internalError" });
  }
});


// Get specific loan details
// NOTE: Only the account which took out the loan can get loan details
router.get("/:loan_number", async (req: Request<{ loan_number: string }>, res: Response<Get_LoanNumber_Res>) => {
  const { loan_number } = req.params;
  const accNo = req.account!.accountNumber;

  try {
    const loanDetails = await getLoanDetails(loan_number, accNo);
    res.status(200).json(loanDetails);
  }
  catch (error) {
    logger.error("Error getting loan details:", error);
    res.status(500).json({ success: false, error: "internalError" });
  }
});

// Update the prime rate
// NOTE: only the hand can update this
router.post("/prime_rate",async (req,res) =>{
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
