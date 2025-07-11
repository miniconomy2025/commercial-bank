import appConfig from "../config/app.config";
import db from "../config/db.config";

export const resetDB = async (time: number): Promise<void> => {
  await db.none(`
    DELETE FROM accounts;
    INSERT INTO accounts (account_number, team_id, notification_url, created_at)
    VALUES 
      (generate_unique_account_number(), 'commercial-bank', 'api/notify', $1),
      (${appConfig.thohAccountNumber}, 'thoh', 'api/notify', $1)
  `, [time]);
};
