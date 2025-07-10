import { ITask } from "pg-promise";
import db from "../config/db.config";

export const getCommercialBankAccountRefId = async (t?: ITask<{}>): Promise<number | null> =>
  (await (t ?? db).oneOrNone(`SELECT id FROM account_refs WHERE team_id = 'commercial-bank' LIMIT 1`))?.id ?? null;

export const getCommercialBankAccountNumber = async (t?: ITask<{}>): Promise<string | null> =>
  (await (t ?? db).oneOrNone(`SELECT account_number FROM accounts WHERE team_id = 'commercial-bank' LIMIT 1`))?.account_number ?? null;

export const doesAccountExist = async (teamId: string): Promise<boolean> => {
  const account = await db.oneOrNone(
    `SELECT 1 FROM accounts WHERE team_id = $1`,
    [teamId]
  );

  return !!account;
};

export const getAccountBalance = async (accountNumber: string, t?: ITask<{}>): Promise<number | null> =>
  (await (t ?? db).oneOrNone(`SELECT * FROM get_account_balance($1) AS balance`, [accountNumber]))?.balance ?? null;

export interface CreateAccountResult { account_number: string; }

export const createAccount = async (
    createdAt: number,
    notificationUrl: string,
    teamId: string
): Promise<CreateAccountResult> => {
    try {
        const result = await db.oneOrNone<{ create_account: string }>(
          'SELECT create_account($1, $2, $3)',
          [createdAt, notificationUrl, teamId]
        );
        
        return result ? { account_number: result.create_account } : { account_number: "" };
    } catch (error) {
        console.error('Error creating account:', error);
        throw error;
    }
}

export type AccountInfo = { net_balance: number; account_number: string; notification_url: string; };
export const getAccountInformation = async (teamId: string): Promise<AccountInfo | null> => {
  try {
    const accountInformation = await db.oneOrNone<AccountInfo>(
      `SELECT 
      SUM(CASE WHEN transactions."to" = accounts.id THEN transactions.amount ELSE 0 END) - 
      SUM(CASE WHEN transactions."from" = accounts.id THEN transactions.amount ELSE 0 END) AS net_balance,
      account_number
      FROM accounts
      LEFT JOIN transactions ON (transactions."to" = accounts.id OR transactions."from" = accounts.id)
      WHERE accounts.team_id = $1
      GROUP BY accounts.id, accounts.account_number;`,
      [teamId]
    )
    return accountInformation;
  }
  catch (error: any) { return error.message }
}

export const getAccountNotificationUrl = async (accountNumber: string): Promise<string | undefined> => {
  const account = await db.oneOrNone(
    `SELECT notification_url FROM accounts WHERE account_number = $1`,
    [accountNumber]
  );
  return account?.notification_url ?? null;
}

export const updateAccountNotificationUrl = async (teamId: string, notificationUrl: string): Promise<void> => {
  await db.none(
    `UPDATE accounts SET notification_url = $1 WHERE team_id = $2`,
    [notificationUrl, teamId]
  );
};