import { Router, Request, Response } from 'express';
import { createLoan, getLoanDetails, getLoanIdFromNumber, getLoanSummariesForAccount, getOutstandingLoanAmount, getTotalOutstandingLoansForAccount, maxLoanableAmount, repayLoan, setLoanInterestRate } from '../queries/loans.queries';
import { logger } from '../utils/logger';
import {
  Post_Loan_Req,
  Post_Loan_Res,
  Get_Loan_Res,
  Post_LoanNumberPay_Req,
  Post_LoanNumberPay_Res,
  Get_LoanNumber_Res,
  Get_Loan_Req
} from '../types/endpoint.types';
import db from '../config/db.config';

//=============== /loan ==============//

const router = Router()

// Take out a loan
router.post("/", async (req: Request<{}, {}, Post_Loan_Req>, res: Response<Post_Loan_Res>) => {
  const { amount } = req.body;
  const borrowerAccNo = req.account!.account_number;

  // Validation: amount >= 0
  if (!amount || isNaN(amount) || amount < 0) {
    res.status(400).json({ success: false, error: "invalidLoanAmount" });
    return;
  }
  // Validation: account exists
  const accountExists = await db.oneOrNone('SELECT 1 FROM accounts WHERE account_number = $1', [borrowerAccNo]);
  if (!accountExists) {
    res.status(404).json({ success: false, error: "accountNotFound" });
    return;
  }
  // Validation: account not frozen
  const frozenStatus = await db.oneOrNone('SELECT is_account_frozen($1) AS frozen', [borrowerAccNo]);
  if (frozenStatus?.frozen) {
    res.status(422).json({ success: false, error: "loanNotPermitted" });
    return;
  }
  // Validation: loan permitted by outstanding loans and bank funds
  const outstandingLoans = await getTotalOutstandingLoansForAccount(borrowerAccNo);
  if (outstandingLoans + amount > maxLoanableAmount) {
    res.status(422).json({ success: false, error: "loanNotPermitted" });
    return;
  }
  try {
    const loanResult = await createLoan(borrowerAccNo, amount);

    if (loanResult.success) {
      res.status(200).json({ success: true, loan_number: loanResult.loan_number });
    } else if (loanResult.error === "invalidLoanAmount") {
      res.status(400).json({ success: false, error: "invalidLoanAmount" });
    } else if (loanResult.error === "loanTooLarge") {
      const { amount_remaining } = loanResult;
      res.status(422).json({ success: false, error: "loanTooLarge", amount_remaining: loanResult.amount_remaining });
    } else if (loanResult.error === "bankDepleted") {
      res.status(503).json({ success: false, error: "bankDepleted" });
    } else {
      res.status(500).json({ success: false, error: "internalError" });
    }
  }
  catch (error) {
    logger.error("Error creating loan:", error);
    res.status(500).json({ success: false, error: "internalError" });
  }
});


// List all loans for the account
// NOTE: Only the original borrower can get details for their loan
router.get("/", async (req: Request<{}, {}, Get_Loan_Req>, res: Response<Get_Loan_Res>) => {
  const accNo = req.account!.account_number;

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
  const accNo = req.account!.account_number;
  // Validation: loan exists
  const loanId = await getLoanIdFromNumber(loan_number);
  if (!loanId) {
    res.status(404).json({ success: false, error: "loanNotFound" });
    return;
  }
  // Validation: loan not written off and not paid off
  const loanSummary = await db.oneOrNone('SELECT write_off FROM loans WHERE loan_number = $1', [loan_number]);
  if (loanSummary?.write_off) {
    res.status(410).json({ success: false, error: "loanWrittenOff" });
    return;
  }
  const outstanding = await getOutstandingLoanAmount(loan_number);
  if (outstanding <= 0) {
    res.status(409).json({ success: false, error: "loanPaidOff" });
    return;
  }
  // Validation: sufficient funds (check against actual repayment amount, not requested amount)
  const accountStatus = await db.oneOrNone('SELECT get_account_balance($1) AS balance', [accNo]);
  const actualRepayment = Math.max(0, Math.min(amount, outstanding)); // Same logic as in repayLoan
  if (!accountStatus || accountStatus.balance < actualRepayment) {
    res.status(422).json({ success: false, error: "paymentNotPermitted" });
    console.log("INSUFFICIENT FUNDS:", accountStatus.balance, actualRepayment);
    return;
  }
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
  const accNo = req.account!.account_number;

  try {
    const loanDetails = await getLoanDetails(loan_number, accNo);
    if (loanDetails.success) {
      const { success, ...loanData } = loanDetails;
      res.status(200).json({ success: true, loan: loanData });
    }
    else if (loanDetails.error === "loanNotFound")
      { res.status(404).json({ success: false, error: "loanNotFound" }); }
    else { res.status(500).json({ success: false, error: "internalError" }); }
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
    res.status(400).json({ success: false, error: "onlyThohCanChangePrimeRate" });
  } else {
    setLoanInterestRate(Number(prime_rate));
    res.status(200).json({ success: true, prime_rate });
  }
});


export default router;
