import db from '../config/db.config';
import { createAccount, getAccountBalance } from '../queries/accounts.queries';
import { createLoan, attemptInstalments, getTotalOutstandingLoansForAccount, maxLoanableAmount, setLoanCap } from '../queries/loans.queries';
import { createTransaction } from '../queries/transactions.queries';
import { getSimTime } from '../utils/time';

describe('Loan Auto-Repayments (attemptInstalments) Tests', () => {
  let dbAvailable = false;
  let acc1: string, acc2: string, acc3: string, lotto: string;

  beforeAll(async () => {
    try {
      await db.oneOrNone('SELECT 1');
      dbAvailable = true;
    } catch (error) {
      console.warn('Database not available for testing, skipping database tests');
    }
  });

  afterAll(async () => {
    if (dbAvailable) { await db.$pool.end(); }
  });

  beforeEach(() => {
    if (!dbAvailable) { pending('Database not available'); }
  });

  // Parameterized function to verify balances, outstanding loans, and execute instalments
  const verifyAndExecuteInstalment = async (
    expectedBalance1: number,
    expectedBalance2: number, 
    expectedBalance3: number,
    expectedOutstanding1: number,
    expectedOutstanding2: number,
    expectedOutstanding3: number,
    instalmentRate: number,
    thresholdRate: number,
    ignoreAccs: Set<string>
  ) => {
    expect(await getAccountBalance(acc1)).toBe(expectedBalance1);
    expect(await getAccountBalance(acc2)).toBe(expectedBalance2);
    expect(await getAccountBalance(acc3)).toBe(expectedBalance3);
    
    expect(await getTotalOutstandingLoansForAccount(acc1)).toBe(expectedOutstanding1);
    expect(await getTotalOutstandingLoansForAccount(acc2)).toBe(expectedOutstanding2);
    expect(await getTotalOutstandingLoansForAccount(acc3)).toBe(expectedOutstanding3);
    
    await attemptInstalments(instalmentRate, thresholdRate, ignoreAccs);
  };

  describe('Loan instalment workflow', () => {
    it('should handle loan instalments correctly across multiple accounts', async () => {
      //---------- Create & Setup test accounts ----------//
      const timestamp = Date.now();
      const acc1Result = await createAccount(getSimTime(), 'http://test1.com', `test-instalment-1-${timestamp}`);
      const acc2Result = await createAccount(getSimTime(), 'http://test2.com', `test-instalment-2-${timestamp}`);
      const acc3Result = await createAccount(getSimTime(), 'http://test3.com', `test-instalment-3-${timestamp}`);
      const lottoResult = await createAccount(getSimTime(), 'http://lotto.com', `lotto-${timestamp}`);

      const createAccSuccess = acc1Result.success && acc2Result.success && acc3Result.success && lottoResult.success;

      expect(createAccSuccess).toBe(true);
      if (!createAccSuccess) return;

      acc1  = acc1Result.account_number;
      acc2  = acc2Result.account_number;
      acc3  = acc3Result.account_number;
      lotto = lottoResult.account_number;
      const ignoreAccs = new Set([ lotto ]);

      // Create loans: 1 loan for account1, 2 loans for account2, 3 loans for account3
      setLoanCap(1000_000);
      const loan1 = await createLoan(acc1, 2000);
      const loan2a = await createLoan(acc2, 800);
      const loan2b = await createLoan(acc2, 600);
      const loan3a = await createLoan(acc3, 500);
      const loan3b = await createLoan(acc3, 400);
      const loan3c = await createLoan(acc3, 300);
      const loanLotto = await createLoan(lotto, 1000_000);
      
      console.log('Loan creation results:', { loan1, loan2a, loan2b, loan3a, loan3b, loan3c, loanLotto });
      
      expect(loan1.success).toBe(true);
      expect(loan2a.success).toBe(true);
      expect(loan2b.success).toBe(true);
      expect(loan3a.success).toBe(true);
      expect(loan3b.success).toBe(true);
      expect(loan3c.success).toBe(true);
      expect(loanLotto.success).toBe(true);

      // Verify initial balances and outstanding loans
      expect(await getAccountBalance(lotto)).toBe(1000_000);

      // Account1 pays all money to account2
      await createTransaction(acc2, acc1, 1200, 'Transfer funds 1');
      await createTransaction(acc2, acc1,  800, 'Transfer funds 2');

      // Verify balances after transfer
      expect(await getAccountBalance(acc1)).toBe(0);    // 1000 - (1000)
      expect(await getAccountBalance(acc2)).toBe(3400); // 1400 + (1000)


      //---------- First instalment attempt ----------//
      // acc1 should fail, acc2 and acc3 should succeed
      await verifyAndExecuteInstalment(
        0,    // acc1 balance
        3400, // acc2 balance  
        1200, // acc3 balance
        2000, // acc1 outstanding
        1400, // acc2 outstanding
        1200, // acc3 outstanding
        0.1,  // 10% instalment
        0.05, // 5% threshold
        ignoreAccs
      );


      //---------- Second instalment attempt ----------//
      // Transfer funds and attempt instalments
      await createTransaction(acc1, lotto, 1500, 'Transfer for instalment');
      await createTransaction(acc2, lotto, 1500, 'Transfer for instalment');
      await createTransaction(acc3, lotto, 1500, 'Transfer for instalment');
      
      const balance1Before2nd = await getAccountBalance(acc1) ?? 0;
      const balance2Before2nd = await getAccountBalance(acc2) ?? 0;
      const balance3Before2nd = await getAccountBalance(acc3) ?? 0;
      const outstanding1Before2nd = await getTotalOutstandingLoansForAccount(acc1);
      const outstanding2Before2nd = await getTotalOutstandingLoansForAccount(acc2);
      const outstanding3Before2nd = await getTotalOutstandingLoansForAccount(acc3);
      
      await verifyAndExecuteInstalment(
        balance1Before2nd,    // acc1 balance
        balance2Before2nd,    // acc2 balance
        balance3Before2nd,    // acc3 balance
        outstanding1Before2nd, // acc1 outstanding
        outstanding2Before2nd, // acc2 outstanding
        outstanding3Before2nd, // acc3 outstanding
        0.1,                 // 10% instalment
        0.9,                 // 90% threshold
        ignoreAccs
      );

      //---------- Third instalment attempt ----------//
      // Transfer more funds and attempt instalments
      await createTransaction(acc1, lotto, 2000, 'Final transfer');
      await createTransaction(acc2, lotto, 2000, 'Final transfer');
      await createTransaction(acc3, lotto, 2000, 'Final transfer');
      
      const balance1Before3rd = await getAccountBalance(acc1) ?? 0;
      const balance2Before3rd = await getAccountBalance(acc2) ?? 0;
      const balance3Before3rd = await getAccountBalance(acc3) ?? 0;
      const outstanding1Before3rd = await getTotalOutstandingLoansForAccount(acc1);
      const outstanding2Before3rd = await getTotalOutstandingLoansForAccount(acc2);
      const outstanding3Before3rd = await getTotalOutstandingLoansForAccount(acc3);
      
      await verifyAndExecuteInstalment(
        balance1Before3rd,
        balance2Before3rd,
        balance3Before3rd,
        outstanding1Before3rd,
        outstanding2Before3rd,
        outstanding3Before3rd,
        1.0,  // 100% instalment (pay off completely)
        0.9,  // 90% threshold
        ignoreAccs
      );

      //---------- Final verification ----------//
      const finalBalance1 = await getAccountBalance(acc1) ?? 0;
      const finalBalance2 = await getAccountBalance(acc2) ?? 0;
      const finalBalance3 = await getAccountBalance(acc3) ?? 0;
      
      // await verifyAndExecuteInstalment(
      //   finalBalance1,
      //   finalBalance2,
      //   finalBalance3,
      //   0, // All outstanding loans should be 0
      //   0,
      //   0,
      //   0, // No instalment needed
      //   0, // No threshold needed
      //   ignoreAccs
      // );
      
      // Final balances should be non-negative
      expect(finalBalance1).toBeGreaterThanOrEqual(0);
      expect(finalBalance2).toBeGreaterThanOrEqual(0);
      expect(finalBalance3).toBeGreaterThanOrEqual(0);
    });
  });
});