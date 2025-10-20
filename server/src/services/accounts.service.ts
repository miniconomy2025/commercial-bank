import {
  createAccount as createAccountQuery,
  getAccountInformation,
  updateAccountNotificationUrl,
  getAccountBalance,
} from '../queries/accounts.queries';
import db from '../config/db.config';

export async function fetchAccountInfo(teamId: string) {
  return await getAccountInformation(teamId);
}

export async function createTeamAccount(params: { createdAt: number; notificationUrl: string; teamId: string }) {
  const result = await createAccountQuery(params.createdAt, params.notificationUrl, params.teamId);
  return result;
}

export async function fetchAccountBalance(accountNumber: string) {
  const balance = await getAccountBalance(accountNumber);
  return balance;
}

export async function fetchFrozenStatus(accountNumber: string) {
  const result = await db.oneOrNone('SELECT is_account_frozen($1) AS frozen', [accountNumber]);
  return result == null ? null : Boolean(result.frozen);
}

export async function setAccountNotificationUrl(teamId: string, url: string) {
  await updateAccountNotificationUrl(teamId, url);
}



