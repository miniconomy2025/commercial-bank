import { Router, Request, Response } from 'express';
import { createAccount, getAllAccounts, insertAccountRef } from '../queries/accounts.queries';
import { logger } from '../utils/logger';
import { getBanks } from '../queries/banks.queries';

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
  const { notification_url ,created_at, bank_name} = req.body;
  try {
    const banks = await getBanks(); // can we not do this in the query => pass param to query and select bank before insert?
    const bankId = banks.find(bank => bank.name === bank_name)?.id;
    const newAccount = await createAccount(notification_url, created_at, bankId ?? 1 );
    await insertAccountRef(newAccount.account_number, bankId ?? 1);

    res.status(201).json(newAccount);
  } catch (error) {
    logger.error('Error creating account:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
export default router;
