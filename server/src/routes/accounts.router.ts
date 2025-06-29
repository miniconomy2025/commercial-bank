import { Router, Request, Response } from 'express';
import { getAllAccounts } from '../queries/accounts.queries';
import { logger } from '../utils/logger';

const router = Router();

router.get('/accounts', async (req: Request, res: Response) => {
  try {
    res.status(200).json(await getAllAccounts());
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
