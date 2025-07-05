import { ITask } from "pg-promise";
import appConfig from "../config/app.config";
import db from "../config/db.config";

export const getCommercialBankAccountRefId = async (t?: ITask<{}>): Promise<number | null> =>
  (await (t ?? db).oneOrNone(`SELECT id FROM account_refs WHERE team_id = 'commercial-bank' LIMIT 1`))?.id ?? null;

export const getCommercialBankAccountNumber = async (t?: ITask<{}>): Promise<string | null> =>
  (await (t ?? db).oneOrNone(`SELECT account_number FROM accounts WHERE team_id = 'commercial-bank' LIMIT 1`))?.account_number ?? null;

// This function serves as an example of how to query the database and will be removed later.
export const getAllAccounts = async (t?: ITask<{}>): Promise<string[]> => {
  return appConfig.isDev? (t ?? db).any('SELECT account_number FROM accounts'): [];
};

export interface CreateAccountResult {
    account_number: string;
}

export const createAccount = async (
    bankName: string,
    createdAt: number,
    notificationUrl: string,
    teamId: string
): Promise<CreateAccountResult> => {
    try {
        const result = await db.proc<CreateAccountResult>(
            'create_account',
            [bankName, createdAt, notificationUrl, teamId, null]
        );
        
        return result ? result : { account_number: "" };
    } catch (error) {
        console.error('Error creating account:', error);
        throw error;
    }
}