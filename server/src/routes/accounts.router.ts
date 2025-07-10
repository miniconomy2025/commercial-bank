import { Router, Request, Response } from 'express';
import { createAccount, CreateAccountResult, getAccountInformation, updateAccountNotificationUrl } from '../queries/accounts.queries';
import { interbankTransfer } from '../queries/banks.queries';
import { logger } from '../utils/logger';
import { getSimTime } from '../utils/time';
import { snakeToCamelCaseMapper } from '../utils/mapper';

const router = Router();

router.get('/account', async (req: Request,res: Response) => {
  try {
    const teamId = req.teamId;
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

router.post('/account', async (req: Request, res: Response) => {
  try {

    const createdAt = getSimTime();
    const { notificationUrl } = snakeToCamelCaseMapper(req.body);
    const teamId = req.teamId;

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

router.post('/interbank-transfer', async (req: Request, res: Response) => {
  try {
    const { transactionNumber, fromBankTeamId, fromAccountNumber, toAccountNumber, amount, description } = req.body;

    if (!transactionNumber || !fromBankTeamId || !fromAccountNumber || !toAccountNumber || !amount || !description) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const transferResult = await interbankTransfer(
      transactionNumber,
      fromBankTeamId,
      fromAccountNumber,
      toAccountNumber,
      amount,
      description
    );

    if (transferResult.success) {
      res.status(200).json({ message: 'Transfer successful' });
    }
    else {
      res.status(400).json({ error: transferResult.error });
    }
  } catch (error) {
    logger.error('Error processing interbank transfer:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/account/me/notify', async (req: Request, res: Response) => {
  try {
    const { notification_url } = req.body;
    const teamId = req.account?.teamId;

    if (!notification_url)  { res.status(400).json({ error: 'notification_url is required' }); }
    else if (!teamId)       { res.status(403).json({ error: 'Not authenticated' }); }
    else {
      await updateAccountNotificationUrl(teamId, notification_url);
      res.status(200).json({ message: 'Notification URL updated' });
    }
  } catch (error) {
    logger.error('Error updating notification URL:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const isValidAccountNumber = (accountNumber: string): boolean => {
  return /^[0-9]+$/.test(accountNumber) && accountNumber.length === 12;
}

export default router;
