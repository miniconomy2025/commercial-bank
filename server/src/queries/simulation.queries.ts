import appConfig from "../config/app.config";
import db from "../config/db.config";

export const resetDB = async (time: number): Promise<void> => {
  await db.none(`
    DELETE FROM accounts;
    DELETE FROM account_refs;
    DELETE FROM transactions;
    DELETE FROM loans;
    DELETE FROM loan_payments;
    INSERT INTO accounts (account_number, team_id, notification_url, created_at)
    VALUES 
      (generate_unique_account_number(), 'commercial-bank', 'api/notify', $1),
      ($2, 'thoh', 'api/notify', $1)
  `, [time, appConfig.thohAccountNumber]);
};

