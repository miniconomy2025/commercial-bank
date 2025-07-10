import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { getSimTime } from '../utils/time';
import { snakeToCamelCaseMapper } from '../utils/mapper';
import { getAllAccountExpenses, getAllExistingAccounts, getAllExistingTransactions, getLoanBalances } from '../queries/dashboard.queries';

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
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/accounts/metrics', async (req: Request, res: Response) => {
  try {
    const account = req.query.account as string;
    const expenses = await getAllAccountExpenses(parseInt(account));
    
    res.status(200).json(expenses);
  } catch (error) {
    logger.error('Error fetching account metrics:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/loans', async (req: Request, res: Response) => {
  try {
    res.status(200).json();
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const account = req.query.account as string;
    const allTransactions = await getAllExistingTransactions(account);
    res.status(200).json(allTransactions);
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
