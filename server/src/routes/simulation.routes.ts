import { Router } from "express";
import { snakeToCamelCaseMapper } from "../utils/mapper";
import { endSimulation, getDateTimeAsISOString, initSimulation } from "../utils/time";
import { createTransaction } from "../queries/transactions.queries";
import { getAccountFromOrganizationUnit } from "../queries/auth.queries";
import { logger } from "../utils/logger";

const router = Router();

router.post("/simulation/start", async (req, res) => {
    const { startingTime, startingBalance, fromAccountNumber } = snakeToCamelCaseMapper(req.body);
    try {
        if (req.teamId !== 'commercial-bank-client') {
            res.status(403).json({ error: "Forbidden: Only THOH can start the simulation" }); 
            return;
        }
        if (!startingTime || !startingBalance || !fromAccountNumber) {
            res.status(400).json({ error: "Bad Request: Missing required fields: starting_time, starting_balance, from_account_number" });
            return;
        }
        initSimulation(startingTime + 10); // Offset by 10ms to account for minor network/request latency
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
        if (req.teamId !== 'commercial-bank-client') {
            res.status(403).json({ error: "Forbidden: Only THOH can stop the simulation" });
            return;
        }
        endSimulation();
        res.status(200).send();
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;