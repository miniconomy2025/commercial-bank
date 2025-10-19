import appConfig from "../config/app.config";
import db from "../config/db.config";

export const resetDB = async (time: number): Promise<void> => {
  await db.tx(async t => {
    // Delete in correct order to avoid foreign key violations
    await t.none('DELETE FROM loan_payments;');
    await t.none('DELETE FROM loans;');
    await t.none('DELETE FROM transactions;');
    await t.none('DELETE FROM account_refs;');
    await t.none('DELETE FROM accounts;');
    
    // Recreate accounts
    await t.none(`
      INSERT INTO accounts (account_number, team_id, notification_url, created_at)
      VALUES 
        (generate_unique_account_number(), 'commercial-bank', 'api/notify', $1),
        ($2, 'thoh', $3, $1)
    `, [time, appConfig.thohAccountNumber, `${appConfig.thohHost}/orders/payments`]);
  });
};

