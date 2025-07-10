import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { getAllAccountExpenses, getAllExistingAccounts, getAllExistingTransactions, getLoanBalances } from '../queries/dashboard.queries';
import { getLoanSummariesForAccount } from '../queries/loans.queries';

const router = Router();

router.get('/accounts', async (req: Request, res: Response) => {
  try {
    const accounts = (await getAllExistingAccounts());
    const accountIds = accounts.map((account: any) => account.id);
    
    const loanBalances = await Promise.all(accountIds.map((id: number) => getLoanBalances(id)));
    const accountsWithLoanBalance = accounts.map((account: any, idx: number) => {
      const loanBalance = loanBalances[idx]?.loan_balance || 0;
      return { ...account, loanBalance };
    });
    res.status(200).json(accountsWithLoanBalance);
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ error: error });
  }
});

router.get('/accounts/metrics', async (req: Request, res: Response) => {
  try {
    const account = req.query.account as string;
    const expenses = await getAllAccountExpenses(parseInt(account));
    
    res.status(200).json(expenses);
  } catch (error) {
    logger.error('Error fetching account metrics:', error);
    res.status(500).json({ error: error });
  }
});

router.get('/loans', async (req: Request, res: Response) => {
  const accNo = req.query.accountNumber as string
   try {
      const loanSummaries = await getLoanSummariesForAccount(accNo);
      res.status(200).json(loanSummaries);
    }
    catch (error) {
      logger.error(`Error getting loans for account ${accNo}:`, error);
      res.status(500).json({ error: error});
    }
});


router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const account = req.query.account as string;
    const allTransactions = await getAllExistingTransactions(account);
    res.status(200).json(allTransactions);
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ error: error });
  }
});

export default router;
