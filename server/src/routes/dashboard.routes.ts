// TODO: Add this file to API spec
// TODO: Add types for request and response in endpoint.types.ts

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { getAllAccountExpenses, getAllExistingAccounts, getAllExistingTransactions, getLoanBalances } from '../queries/dashboard.queries';
import { getLoanSummariesForAccount } from '../queries/loans.queries';
import { Get_AccountMe_Res, Get_Loan_Res, Get_Transaction_Res } from '../types/endpoint.types';

const router = Router();

router.get('/accounts', async (req, res) => {
  try {
    const accounts = (await getAllExistingAccounts());
    const accountIds = accounts.map((account: any) => account.id);
    
    const loanBalances = await Promise.all(accountIds.map((id: number) => getLoanBalances(id)));
    const accountsWithLoanBalance = accounts.map((account: any, idx: number) => {
      const loanBalance = loanBalances[idx]?.loan_balance || 0;
      return { ...account, loanBalance };
    });
    res.status(200).json({ success: true, accounts: accountsWithLoanBalance });
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ success: false, error: 'internalError',  detail:error  });
  }
});

router.get('/accounts/metrics', async (req: Request, res: Response) => {
  try {
    const account = req.query.account as string;
    const expenses = await getAllAccountExpenses(parseInt(account));
    
    res.status(200).json(expenses);
  } catch (error) {
    logger.error('Error fetching account metrics:', error);
    res.status(500).json({ error: 'Internal Server Error' , detail:error });
  }
});

router.get('/loans', async (req, res) => {
  const accNo = req.query.accountNumber as string
   try {
      const loanSummaries = await getLoanSummariesForAccount(accNo);
      res.status(200).json({ success: true, total_outstanding_amount: loanSummaries.reduce((sum, l) => sum + l.outstanding_amount, 0), loans: loanSummaries });
    }
    catch (error) {
      logger.error(`Error getting loans for account ${accNo}:`, error);
      res.status(500).json({ success: false, error: "internalError", detail:error });
    }
});


router.get('/transactions', async (req, res) => {
  try {
    const account = req.query.account as string;
    const allTransactions = await getAllExistingTransactions(account);
    res.status(200).json({ success: true, transactions: allTransactions });
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ success: false, error: 'internalError', detail:error  });
  }
});

export default router;
