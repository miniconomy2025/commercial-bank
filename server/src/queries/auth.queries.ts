import db from "../config/db.config";
import { Account } from "../types/account.type";

export const getAccountFromTeamId = async (teamId: string): Promise<Account | null> => {
  return await db.oneOrNone<Account>(
    `SELECT id, account_number, team_id, notification_url, created_at, closed_at
     FROM accounts WHERE team_id = $1 AND closed_at IS NULL`,
    [teamId]
  );
};
