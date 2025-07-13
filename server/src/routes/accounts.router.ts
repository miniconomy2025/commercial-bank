import { Router, Request, Response } from 'express';
import {
  createAccount,
  getAccountInformation,
  updateAccountNotificationUrl,
  getAccountBalance,
} from '../queries/accounts.queries';
import { interbankTransfer } from '../queries/banks.queries';
import { logger } from '../utils/logger';
import { getSimTime } from '../utils/time';
import {
  Post_Account_Req,
  Post_Account_Res,
  Get_AccountMe_Res,
  Post_AccountMeNotify_Req,
  Post_AccountMeNotify_Res,
  Get_AccountMe_Req,
  Post_InterbankTransfer_Req,
  Post_InterbankTransfer_Res,
} from '../types/endpoint.types';
import db from '../config/db.config';

//=============== /account ==============//

const router = Router();

router.get('/', async (req: Request<{}, {}, Get_AccountMe_Req>, res: Response<Get_AccountMe_Res>) => {
  try {
    const teamId = req.teamId;
    const accInfo = await getAccountInformation(teamId!);

    if (accInfo != null) {
      res.status(200).json({ success: true, ...accInfo });
    } else {
      res.status(404).json({ success: false, error: 'accountNotFound' });
    }
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ success: false, error: 'internalError' });
  }
});

router.post('/', async (req: Request<{}, {}, Post_Account_Req>, res: Response<Post_Account_Res>) => {
  try {
    const createdAt = getSimTime();
    const { notification_url } = req.body;
    const teamId = req.teamId;

    if (!notification_url) {
      res.status(400).json({ success: false, error: 'invalidPayload' });
      return;
    }

    const newAccount = await createAccount(createdAt, notification_url, teamId ?? '');

    if (newAccount.success && newAccount.account_number === 'accountAlreadyExists') {
      logger.info(`Account already exists for team ID: ${teamId}`);
      res.status(409).json({ success: false, error: 'accountAlreadyExists' });
      return;
    }

    if (newAccount.success && isValidteamId(newAccount.account_number)) {
      res.status(201).json({ success: true, account_number: newAccount.account_number });
    } else if (!newAccount.success) {
      res.status(500).json({ success: false, error: newAccount.error ?? 'internalError' });
    } else {
      res.status(500).json({ success: false, error: 'internalError' });
    }
  } catch (error) {
    logger.error('Error creating account:', error);
    res.status(500).json({ success: false, error: 'internalError' });
  }
});

router.post('/interbank-transfer', async (req: Request<{}, {}, Post_InterbankTransfer_Req>, res: Response<Post_InterbankTransfer_Res>) => {
  try {
    const { transaction_number, from_bank_name, from_account_number, to_account_number, amount, description } = req.body;

    if ([transaction_number, from_bank_name, from_account_number, to_account_number, amount, description].some(field => field == null)) {
      res.status(400).json({ success: false, error: 'invalidPayload' }); return;
    }

    const transferResult = await interbankTransfer(transaction_number, from_bank_name, from_account_number, to_account_number, amount, description);

    if (transferResult.success) { res.status(200).json({ success: true }); }
    else                        { res.status(400).json({ success: false, error: "internalError" }); }
  } catch (error) {
    logger.error('Error processing interbank transfer:', error);
    res.status(500).json({ success: false, error: 'internalError' });
  }
} );

router.get('/me/balance', async (req: Request, res: Response) => {
  try {
    const teamId = req.teamId;
    if (!teamId) {
      res.status(404).json({ success: false, error: 'accountNotFound' });
      return;
    }
    const balance = await getAccountBalance(teamId);
    if (balance === null) {
      res.status(404).json({ success: false, error: 'accountNotFound' });
      return;
    }
    res.status(200).json({ success: true, balance });
  } catch (error) {
    logger.error('Error fetching account balance:', error);
    res.status(500).json({ success: false, error: 'internalError' });
  }
});

router.get('/me/frozen', async (req: Request, res: Response) => {
  try {
    const teamId = req.teamId;
    if (!teamId) {
      res.status(404).json({ success: false, error: 'accountNotFound' });
      return;
    }
    // Use the DB helper function for frozen status
    const result = await db.oneOrNone('SELECT is_account_frozen($1) AS frozen', [teamId]);
    if (result === null) {
      res.status(404).json({ success: false, error: 'accountNotFound' });
      return;
    }
    res.status(200).json({ success: true, frozen: result.frozen });
  } catch (error) {
    logger.error('Error checking frozen status:', error);
    res.status(500).json({ success: false, error: 'internalError' });
  }
});

// FIX: Add URL format validation for /account/me/notify
function isValidUrl(urlString?: string): boolean {
  try {
    if (!urlString) return false;
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}

router.post('/account/me/notify', async (req: Request<{}, {}, Post_AccountMeNotify_Req>, res: Response<Post_AccountMeNotify_Res>) => {
  try {
    const { notification_url } = req.body;
    const teamId = req.teamId;

    if (!notification_url || !isValidUrl(notification_url)) { // FIX: Validate URL format
      res.status(400).json({ success: false, error: 'invalidNotificationUrl' });
      return;
    }
    if (!teamId) {
      res.status(403).json({ success: false, error: 'accountNotFound' });
      return;
    }
    await updateAccountNotificationUrl(teamId, notification_url);
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error updating notification URL:', error);
    res.status(500).json({ success: false, error: 'internalError' });
  }
});

const isValidteamId = (teamId: string): boolean => {
  return /^[0-9]+$/.test(teamId) && teamId.length === 12;
}

export default router;
