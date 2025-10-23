// TODO: Add this file to API spec
// TODO: Add types for request and response in endpoint.types.ts

import { Router } from "express";
import { snakeToCamelCaseMapper } from "../utils/mapper";
import { endSimulation, getDateTimeAsISOString, getSimTime, initSimulation } from "../utils/time";
import { createTransaction } from "../queries/transactions.queries";
import { getAccountFromTeamId } from "../queries/auth.queries";
import { logger } from "../utils/logger";
import { attemptInstalments, chargeInterest, setLoanCap } from "../queries/loans.queries";
import { getAllExistingAccounts, getLoanBalances } from "../queries/dashboard.queries";
import { setLoanInterestRate } from "../queries/loans.queries";
import { HttpClient, HttpClientResponse } from "../utils/http-client";
import { catchError, firstValueFrom, map, Observable, of, retry } from "rxjs";
import { resetDB } from "../queries/simulation.queries";
import appConfig from "../config/app.config";

const router = Router();
const httpClient = new HttpClient();

export const PRIME_RATE_DIVISOR = 300.0;
export const INTEREST_CHARGE_INTERVAL = 5;

let dayCounter = 0;

async function onEachDay() {
  try {
    logger.info('Daily loan processing started');

    await attemptInstalments();
    logger.info('Installment processing completed');

    if (dayCounter % INTEREST_CHARGE_INTERVAL == 0) {
      await chargeInterest();
      logger.info(`Interest collected on day ${dayCounter}`);
    }
    else { logger.info(`No interest collected on day ${dayCounter}`); }

  } catch (error) {
    logger.error('Error in daily loan processing:', error);
  }
}

router.post("/", async (req, res) => {
  console.log("========== START SIMULATION ==========")
    try {
        dayCounter = 0;
        const { epochStartTime } = snakeToCamelCaseMapper(req.body);
        console.log(" - START TIME:", epochStartTime);

        const balanceData = await firstValueFrom(getStartingBalance());
        console.log(" - BALANCE DATA:", balanceData);

        if (epochStartTime === undefined || balanceData === undefined) {
          res.status(400).json({ success: false, error: "invalidPayload", details: "epoch_start_time required" });
          return;
        }

        const { investmentValue, primeRate } = snakeToCamelCaseMapper(balanceData);
        
        if (investmentValue === undefined || investmentValue === null) {
          res.status(400).json({ success: false, error: "invalidPayload", details: "investment_value is required" });
          return;
        }
        console.log(" - INVESTMENT VALUE:", investmentValue);
        console.log(" - PRIME RATE:", primeRate);

        setLoanInterestRate(Number(primeRate) / (PRIME_RATE_DIVISOR / (INTEREST_CHARGE_INTERVAL + 1)));
        setLoanCap(investmentValue * (1 - appConfig.fractionalReserve) / 10);

        console.log("--------- RESETTING DB ----------")
        await resetDB(epochStartTime);

        const fromAccountNumber = await getAccountFromTeamId('thoh').then(account => account?.account_number);

        initSimulation(epochStartTime + 10, onEachDay); // Offset by 10ms to account for minor network/request latency

        const toAccountNumber = await getAccountFromTeamId('commercial-bank').then(account => account?.account_number);
        if (!toAccountNumber) {
            res.status(404).json({ success: false, error: "commercialBankAccountNotFound" });
            return;
        }
        if (!fromAccountNumber) {
            res.status(404).json({ success: false, error: "thohAccountNotFound" });
            return;
        }

        await createTransaction(toAccountNumber, fromAccountNumber, investmentValue, `Simulation start with balance ${investmentValue}`, 'thoh', 'commercial-bank');

        res.status(200).send({ success: true, route: `${appConfig.thohHost}/orders/payments` });
    } catch (error) {
        console.log("Error starting simulation:", error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

const getStartingBalance = (): Observable<{ prime_rate: number; investment_value: number } | undefined> => {
  if (!appConfig.isProd) return of({ prime_rate: 0.1, investment_value: 100000000 });

  return httpClient.get(`${appConfig.thohHost}/bank/initialization`).pipe(
    retry(3),
    map((res: HttpClientResponse) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        return res.data as { prime_rate: number; investment_value: number };
      } else {
        return { prime_rate: 0.1, investment_value: 10000000000 };
      }
    }),
    catchError(() => of({ prime_rate: 0.1, investment_value: 10000000000 }))
  );
};

router.delete("/", async (req, res) => {
    try {
        endSimulation();
        resetDB(getSimTime());
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: "Internal Server Error" });
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

// Admin endpoint to manually trigger interest charging
router.post('/charge-interest', async (req, res) => {
  const teamId = req.teamId;
  
  if (teamId !== 'thoh') {
    res.status(403).json({ success: false, error: 'onlyThohCanTriggerInterest' });
    return;
  }
  
  try {
    await chargeInterest();
    res.status(200).json({ success: true, message: 'Interest charged on all outstanding loans' });
  } catch (error) {
    logger.error('Error charging interest:', error);
    res.status(500).json({ success: false, error: 'internalError' });
  }
});

// Admin endpoint to manually trigger installment processing
router.post('/process-installments', async (req, res) => {
  const teamId = req.teamId;
  
  if (teamId !== 'thoh') {
    res.status(403).json({ success: false, error: 'onlyThohCanTriggerInstallments' });
    return;
  }
  
  try {
    await attemptInstalments();
    res.status(200).json({ success: true, message: 'Installment processing completed' });
  } catch (error) {
    logger.error('Error processing installments:', error);
    res.status(500).json({ success: false, error: 'internalError' });
  }
});

export default router;