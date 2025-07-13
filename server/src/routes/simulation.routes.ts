// TODO: Add this file to API spec
// TODO: Add types for request and response in endpoint.types.ts

import { Router, Response } from "express";
import { snakeToCamelCaseMapper } from "../utils/mapper";
import { endSimulation, getDateTimeAsISOString, initSimulation } from "../utils/time";
import { createTransaction } from "../queries/transactions.queries";
import { getAccountFromOrganizationUnit } from "../queries/auth.queries";
import { logger } from "../utils/logger";
import { attemptInstalments, setLoanCap } from "../queries/loans.queries";
import { getAllExistingAccounts, getLoanBalances } from "../queries/dashboard.queries";
import { setLoanInterestRate } from "../queries/loans.queries";
import { HttpClient, HttpClientResponse } from "../utils/http-client";
import { catchError, firstValueFrom, map, Observable, of, retry } from "rxjs";
import { resetDB } from "../queries/simulation.queries";
import appConfig from "../config/app.config";

const router = Router();
const httpClient = new HttpClient();

function onEachDay() {
    attemptInstalments();
}

router.post("/", async (req, res) => {
    try {
        const { epochStartTime } = snakeToCamelCaseMapper(req.body);

        const balanceData = await firstValueFrom(getStartingBalance());

        if (epochStartTime === undefined || balanceData === undefined) {
          res.status(400).json({ error: "Invalid payload: epoch_start_time required" });
          return;
        }

        const { investmentValue, primeRate } = snakeToCamelCaseMapper(balanceData);

        resetDB(epochStartTime);

        setLoanInterestRate(Number(primeRate));
        setLoanCap(investmentValue * (1 - appConfig.fractionalReserve) /10);
        const fromAccountNumber = await getAccountFromOrganizationUnit('thoh').then(account => account?.accountNumber);
        initSimulation(epochStartTime + 10, onEachDay); // Offset by 10ms to account for minor network/request latency
        const toAccountNumber = await getAccountFromOrganizationUnit('commercial-bank').then(account => account?.accountNumber);
        if (!toAccountNumber) {
            res.status(404).json({ error: "Commercial bank account not found" });
            return;
        }
        if (!fromAccountNumber) {
            res.status(404).json({ error: "THOH account not found" });
            return;
        }
        await createTransaction(toAccountNumber, fromAccountNumber, investmentValue, `Simulation start with balance ${investmentValue}`, 'thoh', 'commercial-bank');
        res.status(200).send();
    } catch (error) {
        logger.error("Error starting simulation:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

const getStartingBalance = (): Observable<{ prime_rate: number; investment_value: number } | undefined> => {
  return httpClient.get(`${appConfig.thohHost}/bank/initialization`).pipe(
    retry(3),
    map((res: HttpClientResponse) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        return res.data as { prime_rate: number; investment_value: number };
      } else {
        return { prime_rate: 0.01, investment_value: 1000000000 }; // Default values if the request fails
      }
    }),
    catchError(() => of({ prime_rate: 0.01, investment_value: 1000000000 }))
  );
};

router.delete("/", async (req, res) => {
    try {
        endSimulation();
        res.status(200).send();
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.get('/accounts', async (req, res) => {
  try {
    const accounts = (await getAllExistingAccounts());
    const accountIds = accounts.map((account: any) => account.id);
    const loanBalances = await Promise.all(accountIds.map((id: number) => getLoanBalances(id)));
    const accountsWithLoanBalance = accounts.map((account: any, idx: number) => {
      const loanBalance = loanBalances[idx]?.loan_balance || 0;
      return { ...account, loanBalance };
    });
    res.status(200).json({ success: true, accounts: accountsWithLoanBalance });
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ success: false, error: 'internalError' });
  }
});

export default router;