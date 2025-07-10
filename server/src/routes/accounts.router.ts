import { Router, Request, Response } from 'express';
import { createAccount, CreateAccountResult, getAccountInformation } from '../queries/accounts.queries';
import { logger } from '../utils/logger';
import { getSimTime } from '../utils/time';
import { snakeToCamelCaseMapper } from '../utils/mapper';

const router = Router();

router.get('/account', async (req: Request,res: Response) => {
  try {
    const teamId = req.account?.teamId;
    const accountInformation = await getAccountInformation(teamId!);

    if(accountInformation) {
      res.status(200).json(accountInformation);
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/accounts', async (req: Request, res: Response) => {
  try {

    const createdAt = getSimTime();
    const { notificationUrl } = snakeToCamelCaseMapper(req.body);
    const teamId = req.account?.teamId;

    if (!notificationUrl) {
      res.status(400).json({ error: 'Notification URL is required' });
      return;
    }

    const newAccount: CreateAccountResult = await createAccount(createdAt, notificationUrl, teamId ?? '');

    if (newAccount.account_number === 'account exist') {
      logger.info(`Account already exists for team ID: ${teamId}`);
      res.status(409).json({ error: 'Account already exists for this team' });
      return;
    }

    if(isValidAccountNumber(newAccount.account_number)) {
      res.status(201).json(newAccount)
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    };

  } catch (error) {
    logger.error('Error creating account:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const isValidAccountNumber = (accountNumber: string): boolean => {
  return /^[0-9]+$/.test(accountNumber) && accountNumber.length === 12;
}

export default router;
