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

export interface CreateAccountResult {
    account_number: string;
}

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