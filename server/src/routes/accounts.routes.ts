import { Router, Request, Response } from 'express';
import { createAccount, doesAccountExist } from '../queries/accounts.queries';
import { logger } from '../utils/logger';
import { getBanks } from '../queries/banks.queries';
import { snakeToCamelCaseMapper } from '../utils/mapper';

const router = Router();

router.post('/accounts', async (req: Request, res: Response) => {
  const { notificationUrl } = snakeToCamelCaseMapper(req.body);
  const teamId = req.teamId!;
  try {
    if (!notificationUrl) {
      res.status(400).json({ error: 'Notification URL is required' });
      return;
    }
    const accountAlreadyExists = await doesAccountExist(teamId);
    if (accountAlreadyExists) {
      logger.info(`Account already exists for team ID: ${teamId}`);
      res.status(409).json({ error: 'Account already exists for this team' });
      return;
    }
    
    const newAccount = await createAccount(notificationUrl, teamId);
    res.status(201).json(newAccount);
  } catch (error) {
    logger.error('Error creating account:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
export default router;
