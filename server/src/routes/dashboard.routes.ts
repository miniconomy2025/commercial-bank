import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { getSimTime } from '../utils/time';
import { snakeToCamelCaseMapper } from '../utils/mapper';
import { getAllAccountExpenses, getAllExistingAccounts, getAllExistingTransactions } from '../queries/dashboard.queries';

const router = Router();

router.get('/accounts', async (req: Request, res: Response) => {
  try {
    const accounts = await getAllExistingAccounts();
    res.status(200).json(accounts);
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/accounts/expenses', async (req: Request, res: Response) => {
  try {
    const account = req.query.account as string;
    const expenses = await getAllAccountExpenses(parseInt(account));
    
    res.status(200).json(expenses);
  } catch (error) {
    logger.error('Error fetching accounts:', error);
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
    const allTransactions = await getAllExistingTransactions(parseInt(account));
    res.status(200).json(allTransactions);
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
