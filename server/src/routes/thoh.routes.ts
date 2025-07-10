import { Router } from "express";
import { snakeToCamelCaseMapper } from "../utils/mapper";
import { endSimulation, getDateTimeAsISOString, initSimulation } from "../utils/time";
import { createTransaction } from "../queries/transactions.queries";
import { getAccountFromOrganizationUnit } from "../queries/auth.queries";
import { logger } from "../utils/logger";
import { attemptInstalments } from "../queries/loans.queries";

import appConfig from "../config/app.config";
import { getAllExistingAccounts, getLoanBalances } from "../queries/dashboard.queries";

const router = Router();

function onEachDay() {
    attemptInstalments();
}

router.use((req, res, next) => {
    if (req.teamId !== appConfig.thohTeamId) {
        res.status(403).json({ error: "Forbidden: Only THOH can access this endpoint" });
        return;
    }
    next();
});

router.post("/simulation/start", async (req, res) => {
    const { startingTime, startingBalance, fromAccountNumber } = snakeToCamelCaseMapper(req.body);
    try {
        if (!startingTime || !startingBalance || !fromAccountNumber) {
            res.status(400).json({ error: "Bad Request: Missing required fields: starting_time, starting_balance, from_account_number" });
            return;
        }
        initSimulation(startingTime + 10, onEachDay); // Offset by 10ms to account for minor network/request latency
        const toAccountNumber = await getAccountFromOrganizationUnit('commercial-bank').then(account => account?.accountNumber);
        if (!toAccountNumber) {
            res.status(404).json({ error: "Commercial bank account not found" });
            return;
        }
        await createTransaction(fromAccountNumber, toAccountNumber, startingBalance, `Simulation start with balance ${startingBalance}`, 'thoh', 'commercial-bank')
        res.status(200).send(getDateTimeAsISOString());
    } catch (error) {
        logger.error("Error starting simulation:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/simulation/end", async (req, res) => {
    try {
        endSimulation();
        res.status(200).send();
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.get('/accounts', async (req , res) => {
  try {
    const accounts = (await getAllExistingAccounts());
    const accountIds = accounts.map((account: any) => account.id);
    const loanBalances = await Promise.all(accountIds.map((id: number) => getLoanBalances(id)));
    const accountsWithLoanBalance = accounts.map((account: any, idx: number) => {
      const loanBalance = loanBalances[idx]?.loan_balance || 0;
      return { ...account, loanBalance };
    });
    res.status(200).json(accountsWithLoanBalance);
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;