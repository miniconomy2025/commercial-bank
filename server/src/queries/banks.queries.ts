import db from "../config/db.config";

export const getBanks = async (): Promise<Bank[]> => {
  return await db.many('SELECT id, name FROM banks');
};

export type Bank = {
    id: number;   
    name: string;
};