import { ITask } from "pg-promise";
import db from "../config/db.config";
import { AccountInfo, Post_Account_Res } from "../types/endpoint.types";

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

export const getAccountBalance = async (accountNumber: string, t?: ITask<{}>): Promise<number | null> => {
  const bal = (await (t ?? db).oneOrNone(`SELECT * FROM get_account_balance($1) AS balance`, [accountNumber]))?.balance;
  return bal == null ? null : parseFloat(bal);
}

export const createAccount = async (
    createdAt: number,
    notificationUrl: string,
    teamId: string
): Promise<Post_Account_Res> => {
    try {
        // Check if account already exists
        if (await doesAccountExist(teamId)) {
          return { success: false, error: "accountAlreadyExists" };
        }

        const result = await db.oneOrNone<{ create_account: string }>(
          'SELECT create_account($1, $2, $3)',
          [createdAt, notificationUrl, teamId]
        );
        
        if (!result || !result.create_account) {
          return { success: false, error: "internalError" };
        }

        return { success: true, account_number: result.create_account };
    } catch (error) {
        console.error('Error creating account:', error);
        return { success: false, error: "internalError" };
    }
}

export const getAccountInformation = async (teamId: string): Promise<AccountInfo | null> => {
  try {
    const result = await db.oneOrNone(
      `SELECT 
        a.account_number,
        (COALESCE(incoming.total, 0) - COALESCE(outgoing.total, 0))::numeric AS net_balance,
        COALESCE(a.notification_url, '') AS notification_url
      FROM accounts a
      LEFT JOIN account_refs ar ON a.account_number = ar.account_number
      LEFT JOIN (
        SELECT t."to" AS account_ref_id, SUM(t.amount) AS total
        FROM transactions t
        GROUP BY t."to"
      ) incoming ON ar.id = incoming.account_ref_id
      LEFT JOIN (
        SELECT t."from" AS account_ref_id, SUM(t.amount) AS total
        FROM transactions t
        GROUP BY t."from"
      ) outgoing ON ar.id = outgoing.account_ref_id
      WHERE a.team_id = $1;`,
      [teamId]
    );

    return result == null ? null : {
      ...result,
      net_balance: parseFloat(result.net_balance),
    };
  }
  catch (error: any) { 
    console.error('Error in getAccountInformation:', error);
    return null;
  }
}

export const getAccountNotificationUrl = async (accountNumber: string): Promise<string | null> => {
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