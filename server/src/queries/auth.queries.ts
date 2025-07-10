import db from "../config/db.config";
import { Account } from "../types/account.type";
import { snakeToCamelCaseMapper } from "../utils/mapper";

export const getAccountFromOrganizationUnit = async (organizationUnit: string): Promise<Account| undefined> => {
  const result = await db.oneOrNone(
    `SELECT id, account_number, team_id, notification_url, created_at, closed_at
     FROM accounts WHERE team_id = $1 AND closed_at IS NULL`,
    [organizationUnit]
  );

  if (!result) {
    return undefined;
  }

  return snakeToCamelCaseMapper(result) as Account;
};
