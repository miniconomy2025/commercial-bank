import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { getAllAccountExpenses, getAllExistingAccounts, getAllExistingTransactions, getLoanBalances } from '../queries/dashboard.queries';
import appConfig from '../config/app.config';

const router = Router();
router.use((req: Request, res: Response, next: () => void) => {
  const dashboardId = req.query.clientId;
  if (!dashboardId) {
    res.status(400).json({ error: 'Dashboard ID is required' });
    return;
  }
  if (dashboardId !== appConfig.clientId) {
    res.status(400).json({ error: 'Invalid dashboard ID' });
    return;
  }

  next();
});

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
