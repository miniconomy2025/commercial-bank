import appConfig from "../config/app.config";
import db from "../config/db.config";

// This function serves as an example of how to query the database and will be removed later.
export const getAllAccounts = async (): Promise<string[]> => {
  return appConfig.isDev? db.any('SELECT account_number FROM accounts'): [];
};
