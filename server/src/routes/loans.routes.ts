import { Router, Request, Response } from 'express';
import { createNewLoan, fetchLoansForAccount, repayLoanForNumber, fetchLoanDetails, updatePrimeRate } from '../services/loans.service';
import db from '../config/db.config';
import { logger } from '../utils/logger';

//=============== /loan ==============//

const router = Router()

router.post("/", async (req: Request, res: Response) => {
  const { amount } = req.body as { amount: number };
  const borrowerAccNo = req.account!.account_number;
  if (!amount || isNaN(amount) || amount < 0) {
    res.status(400).json({ success: false, error: "invalidLoanAmount" });
    return;
  }
  try {
    const loanResult = await createNewLoan({ borrowerAccNo, amount });
    if (loanResult.success) {
      res.status(200).json({ success: true, loan_number: (loanResult as any).loan_number });
    } else if ((loanResult as any).error === "invalidLoanAmount") {
      res.status(400).json({ success: false, error: "invalidLoanAmount" });
    } else if ((loanResult as any).error === "loanTooLarge") {
      res.status(422).json({ success: false, error: "loanTooLarge", amount_remaining: (loanResult as any).amount_remaining });
    } else if ((loanResult as any).error === "bankDepleted") {
      res.status(503).json({ success: false, error: "bankDepleted" });
    } else if ((loanResult as any).error === 'accountNotFound') {
      res.status(404).json({ success: false, error: 'accountNotFound' });
    } else if ((loanResult as any).error === 'loanNotPermitted') {
      res.status(422).json({ success: false, error: 'loanNotPermitted' });
    } else {
      res.status(500).json({ success: false, error: "internalError" });
    }
  }
  catch (error) {
    logger.error("Error creating loan:", error);
    res.status(500).json({ success: false, error: "internalError" });
  }
});


router.get("/", async (req: Request, res: Response) => {
  const accNo = req.account!.account_number;
  try {
    const loanSummaries = await fetchLoansForAccount(accNo);
    res.status(200).json({ success: true, total_outstanding_amount: loanSummaries.reduce((sum, l) => sum + l.outstanding_amount, 0), loans: loanSummaries });
  }
  catch (error) {
    logger.error(`Error getting loans for account ${accNo}:`, error);
    res.status(500).json({ success: false, error: "internalError" });
  }
});


router.post("/:loan_number/pay", async (req: Request<{ loan_number: string }>, res: Response) => {
  const { amount } = req.body as { amount: number };
  if (!amount || isNaN(amount) || amount <= 0) {
    res.status(400).json({ success: false, error: "invalidPayload" });
    return;
  }
  const { loan_number } = req.params;
  const accNo = req.account!.account_number;
  const result = await repayLoanForNumber({ loan_number, accNo, amount });
  switch (result.kind) {
    case 'loanNotFound':
      res.status(404).json({ success: false, error: "loanNotFound" }); return;
    case 'loanWrittenOff':
      res.status(410).json({ success: false, error: "loanWrittenOff" }); return;
    case 'loanPaidOff':
      res.status(409).json({ success: false, error: "loanPaidOff" }); return;
    case 'paymentNotPermitted':
      res.status(422).json({ success: false, error: "paymentNotPermitted" }); return;
    case 'ok':
      res.status(200).json(result.repayment); return;
  }
});


router.get("/:loan_number", async (req: Request<{ loan_number: string }>, res: Response) => {
  const { loan_number } = req.params;
  const accNo = req.account!.account_number;
  try {
    const loanDetails = await fetchLoanDetails({ loan_number, accNo });
    if ((loanDetails as any).success)
      { res.status(200).json({ success: true, loan: loanDetails }); }
    else if ((loanDetails as any).error === "loanNotFound")
      { res.status(404).json({ success: false, error: "loanNotFound" }); }
    else { res.status(500).json({ success: false, error: "internalError" }); }
  }
  catch (error) {
    logger.error("Error getting loan details:", error);
    res.status(500).json({ success: false, error: "internalError" });
  }
});

router.post("/prime_rate", async (req: Request, res: Response) =>{
  const teamId = req.teamId
  const {prime_rate} = req.body;
  if (teamId!=="thoh"){
    res.status(400).json({ success: false, error: "onlyThohCanChangePrimeRate" });
  } else {
    updatePrimeRate(Number(prime_rate));
    res.status(200).json({ success: true, prime_rate });
  }
});


export default router;
