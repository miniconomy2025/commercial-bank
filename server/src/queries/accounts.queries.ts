import appConfig from "../config/app.config";
import db from "../config/db.config";

// This function serves as an example of how to query the database and will be removed later.
export const getAllAccounts = async (): Promise<string[]> => {
  return appConfig.isDev? db.any('SELECT account_number, team_id FROM accounts'): [];
};

export const createAccount = async (notification_url: string, created_at: Date, bank_id: Number): Promise<createAccountResponse> => {
  const account = await db.one(
    'INSERT INTO accounts (account_number,notification_url, created_at) VALUES (generate_unique_account_number(),$1, $2) RETURNING account_number,created_at',
    [notification_url, created_at, bank_id]
  );

  return account;
};

export const insertAccountRef = async (account_number: string, bank_id: number): Promise<void> => {
  await db.result(  
    'INSERT INTO account_refs(account_number, bank_id) VALUES ($1, $2)',
    [account_number, bank_id]
  );
}

export type createAccountResponse = {
  account_number: string;
  created_at: Date;
};