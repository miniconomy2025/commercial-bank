import { Router } from 'express';
import { accountMiddleware } from '../middlewares/auth.middleware';
import { fetchAccountInfo, createTeamAccount, fetchAccountBalance, fetchFrozenStatus, setAccountNotificationUrl } from '../services/accounts.service';
import { logger } from '../utils/logger';
import { getSimTime } from '../utils/time';

//=============== /account ==============//

const router = Router();

router.get('/me', async (req, res) => {
  try {
    const teamId = req.teamId;
    const accInfo = await fetchAccountInfo(teamId!);
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

router.post('/', async (req, res) => {
  try {
    const createdAt = getSimTime();
    const notification_url = req.body?.notification_url ?? "";
    const teamId = req.teamId ?? '';
    const newAccount = await createTeamAccount({ createdAt, notificationUrl: notification_url, teamId });
    if (!newAccount.success && newAccount.error === 'accountAlreadyExists') {
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



router.get('/me/balance', accountMiddleware, async (req, res) => {
  try {
    const accountNumber = req.account?.account_number;
    if (accountNumber == null) {
      res.status(404).json({ success: false, error: 'accountNotFound' });
      return;
    }
    const balance = await fetchAccountBalance(accountNumber);
    if (balance == null) {
      res.status(404).json({ success: false, error: 'accountNotFound' });
      return;
    }
    res.status(200).json({ success: true, balance });
  } catch (error) {
    logger.error('Error fetching account balance:', error);
    res.status(500).json({ success: false, error: 'internalError' });
  }
});

router.get('/me/frozen', accountMiddleware, async (req, res) => {
  try {
    const accountNumber = req.account?.account_number;
    if (!accountNumber) {
      res.status(404).json({ success: false, error: 'accountNotFound' });
      return;
    }
    const frozen = await fetchFrozenStatus(accountNumber);
    if (frozen == null) {
      res.status(404).json({ success: false, error: 'accountNotFound' });
      return;
    }
    res.status(200).json({ success: true, frozen });
  } catch (error) {
    logger.error('Error checking frozen status:', error);
    res.status(500).json({ success: false, error: 'internalError' });
  }
});

function isValidUrl(urlString?: string): boolean {
  try {
    if (!urlString) return false;
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}

router.post('/account/me/notify', async (req, res) => {
  try {
    const { notification_url } = req.body;
    const teamId = req.teamId;
    if (!notification_url || !isValidUrl(notification_url)) {
      res.status(400).json({ success: false, error: 'invalidNotificationUrl' });
      return;
    }
    if (!teamId) {
      res.status(403).json({ success: false, error: 'accountNotFound' });
      return;
    }
    await setAccountNotificationUrl(teamId, notification_url);
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
