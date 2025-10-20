import { snakeToCamelCaseMapper } from "../utils/mapper";
import { endSimulation, getSimTime, initSimulation } from "../utils/time";
import { createTransaction } from "../queries/transactions.queries";
import { getAccountFromTeamId } from "../queries/auth.queries";
import { logger } from "../utils/logger";
import { attemptInstalments, setLoanCap } from "../queries/loans.queries";
import { getAllExistingAccounts, getLoanBalances } from "../queries/dashboard.queries";
import { setLoanInterestRate } from "../queries/loans.queries";
import { HttpClient, HttpClientResponse } from "../utils/http-client";
import { catchError, firstValueFrom, map, Observable, of, retry } from "rxjs";
import { resetDB } from "../queries/simulation.queries";
import appConfig from "../config/app.config";

const httpClient = new HttpClient();

function onEachDay() {
  attemptInstalments();
}

export const startSimulation = async (params: { epochStartTime: number }) => {
  console.log("========== START SIMULATION ==========")
  try {
      const { epochStartTime } = params;
      console.log(" - START TIME:", epochStartTime);

      const balanceData = await firstValueFrom(getStartingBalance());
      console.log(" - BALANCE DATA:", balanceData);

      if (epochStartTime === undefined || balanceData === undefined) {
        return { success: false, error: "invalidPayload", details: "epoch_start_time required" } as const;
      }

      const { investmentValue, primeRate } = snakeToCamelCaseMapper(balanceData);
      console.log(" - INVESTMENT VALUE:", investmentValue);
      console.log(" - PRIME RATE:", primeRate);

      console.log("--------- RESETTING DB ----------")
      await resetDB(epochStartTime);

      setLoanInterestRate(Number(primeRate));
      setLoanCap(investmentValue * (1 - appConfig.fractionalReserve) /10);
      const fromAccountNumber = await getAccountFromTeamId('thoh').then(account => account?.account_number);
      initSimulation(epochStartTime + 10, onEachDay);
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
      return { success: true, route: `${appConfig.thohHost}/orders/payments` } as const;
  } catch (error) {
      console.log("Error starting simulation:", error);
      return { success: false, error: "Internal Server Error" } as const;
  }
};

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

export const stopSimulation = async () => {
  try {
      endSimulation();
      resetDB(getSimTime());
      return { success: true } as const;
  } catch (error) {
      return { success: false, error: "Internal Server Error" } as const;
  }
};

export const listAccounts = async () => {
  const accounts = (await getAllExistingAccounts());
  const accountIds = accounts.map((account: any) => account.id);
  const loanBalances = await Promise.all(accountIds.map((id: number) => getLoanBalances(id)));
  const accountsWithLoanBalance = accounts.map((account: any, idx: number) => {
    const loanBalance = loanBalances[idx]?.loan_balance || 0;
    return { ...account, loanBalance };
  });
  return accountsWithLoanBalance;
};


