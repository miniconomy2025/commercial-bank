// TODO: Add this file to API spec
// TODO: Add types for request and response in endpoint.types.ts

import { Router, Request, Response } from 'express';
import { getAccountsWithLoanBalance, getExpensesForAccount, getLoansForAccount, getTransactionsForAccount } from '../services/dashboard.service';
import { logger } from '../utils/logger';

const router = Router();

router.get('/accounts', async (req: Request, res: Response) => {
  try {
    const accountsWithLoanBalance = await getAccountsWithLoanBalance();
    res.status(200).json({ success: true, accounts: accountsWithLoanBalance });
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ success: false, error: 'internalError',  detail:error  });
  }
});

router.get('/accounts/metrics', async (req: Request, res: Response) => {
  try {
    const account = req.query.account as string;
    const expenses = await getExpensesForAccount(parseInt(account));
    res.status(200).json({ success: true, expenses });
  } catch (error) {
    logger.error('Error fetching account metrics:', error);
    res.status(500).json({ success: false, error: 'internalError' , detail: error });
  }
});

router.get('/loans', async (req: Request, res: Response) => {
  const accNo = req.query.accountNumber as string
   try {
      const loanSummaries = await getLoansForAccount(accNo);
      res.status(200).json({ success: true, total_outstanding_amount: loanSummaries.reduce((sum, l) => sum + l.outstanding_amount, 0), loans: loanSummaries });
    }
    catch (error) {
      logger.error(`Error getting loans for account ${accNo}:`, error);
      res.status(500).json({ success: false, error: "internalError", detail:error });
    }
});


router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const account = req.query.account as string;
    const allTransactions = await getTransactionsForAccount(account);
    res.status(200).json({ success: true, transactions: allTransactions });
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ success: false, error: 'internalError', detail:error  });
  }
});

export default router;
