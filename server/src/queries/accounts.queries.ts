import { ITask } from "pg-promise";
import db from "../config/db.config";
import { getSimTime, SimTime } from "../utils/time";

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

export const createAccount = async (notificationUrl: string, teamId: string): Promise<createAccountResponse> => {
  const account = await db.tx(async (t) => {
    return t.one(
      `
      WITH selected_bank AS (
        SELECT id AS bank_id FROM banks WHERE name = 'commercial-bank' LIMIT 1
      ), inserted_account AS (
        INSERT INTO accounts (account_number, team_id, notification_url, created_at)
        SELECT generate_unique_account_number(), $1, $2, $3
        FROM selected_bank
        RETURNING account_number, created_at
      ), inserted_ref AS (
        INSERT INTO account_refs (account_number, bank_id)
        SELECT inserted_account.account_number, selected_bank.bank_id
        FROM inserted_account, selected_bank
      )
      SELECT account_number, created_at FROM inserted_account
      `,
      [teamId, notificationUrl, getSimTime()]
    );
  });

  return account;
};

export type createAccountResponse = {
  account_number: string;
  created_at: SimTime;
};