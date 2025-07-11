import { Router } from "express";
import { snakeToCamelCaseMapper } from "../utils/mapper";
import { endSimulation, getDateTimeAsISOString, initSimulation } from "../utils/time";
import { createTransaction } from "../queries/transactions.queries";
import { getAccountFromOrganizationUnit } from "../queries/auth.queries";
import { logger } from "../utils/logger";
import { attemptInstalments } from "../queries/loans.queries";
import { getAllExistingAccounts, getLoanBalances } from "../queries/dashboard.queries";
import { setLoanInterestRate } from "../queries/loans.queries";
import { HttpClient } from "../utils/http-client";
import { retry } from "rxjs";
import { resetDB } from "../queries/simulation.queries";

const router = Router();
const httpClient = new HttpClient();

function onEachDay() {
    attemptInstalments();
}

router.post("/start", async (req, res) => {
    try {
        const { startingTime } = snakeToCamelCaseMapper(req.body);

        const balanceData = await getStartingBalance();

        if (!startingTime || !balanceData) {
          res.status(400).json({ error: "Bad Request: Missing required fields: starting_time, starting_balance, from_account_number" });
          return;
        }

        const { initial_bank_balance, prime_rate } = balanceData;

        if (!startingTime ) {
            res.status(400).json({ error: "Bad Request: Missing required fields: starting_time, starting_balance, from_account_number" });
            return;
        }

        resetDB(startingTime);

        setLoanInterestRate(Number(prime_rate))
        const fromAccountNumber = await getAccountFromOrganizationUnit('thoh').then(account => account?.accountNumber);
        initSimulation(startingTime + 10, onEachDay); // Offset by 10ms to account for minor network/request latency
        const toAccountNumber = await getAccountFromOrganizationUnit('commercial-bank').then(account => account?.accountNumber);
        if (!toAccountNumber) {
            res.status(404).json({ error: "Commercial bank account not found" });
            return;
        }
        await createTransaction(fromAccountNumber!, toAccountNumber, initial_bank_balance, `Simulation start with balance ${initial_bank_balance}`, 'thoh', 'commercial-bank');
        res.status(200).send(getDateTimeAsISOString());
    } catch (error) {
        logger.error("Error starting simulation:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

const getStartingBalance = async (): Promise<{prime_rate:number,initial_bank_balance:number} | undefined> => {
  try {
    httpClient.get('https://thoh-api.projects.bbdgrad.com/api/bank/initialization').pipe(
        retry(3) // Retry up to 3 times on failure
    ).subscribe({
        next: (data) => {
            return data
        },
        error: (error) => {
            console.log('Error fetching starting balance:', error);
            return undefined;
        },
    });
    return undefined;
  } catch (error) {
    console.log('Error fetching starting balance:', error);
    return undefined;
  }
};

router.post("/end", async (req, res) => {
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