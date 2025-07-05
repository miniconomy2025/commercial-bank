import { Router, Request, Response } from 'express';
import { createAccount, getAllAccounts, CreateAccountResult } from '../queries/accounts.queries';
import { logger } from '../utils/logger';
import { getSimTime } from '../utils/time';

const router = Router();

router.get('/accounts', async (req: Request, res: Response) => {
  try {
    res.status(200).json(await getAllAccounts());
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/accounts', async (req: Request, res: Response) => {
  const { notificationUrl , bankName, teamId } = req.body;
  try {
    const createdAt = getSimTime();
    const newAccount: CreateAccountResult = await createAccount(bankName ?? 'commercial-bank', createdAt, notificationUrl, teamId);

    res.status(201).json(newAccount);
  } catch (error) {
    logger.error('Error creating account:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
export default router;
