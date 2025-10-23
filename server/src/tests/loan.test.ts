import db from "../config/db.config";
import { getSimTime } from "../utils/time";
import * as accountsQueries from "../queries/accounts.queries";
import * as transactionsQueries from "../queries/transactions.queries";
import { sendNotification } from '../utils/notification';
import * as loansQueries from "../queries/loans.queries";

jest.mock("../config/db.config", () => ({
  __esModule: true,
  default: {
    one: jest.fn(),
    oneOrNone: jest.fn(),
    many: jest.fn(),
    manyOrNone: jest.fn(),
    none: jest.fn(),
    batch: jest.fn(),
    tx: jest.fn(),
  }
}));

jest.mock("../utils/time");
jest.mock("../queries/accounts.queries");
jest.mock("../queries/transactions.queries");
jest.mock("../utils/notification");

const mockedDb = db as jest.Mocked<typeof db>;
const mockedGetSimTime = getSimTime as jest.MockedFunction<typeof getSimTime>;
const mockedAccountsQueries = accountsQueries as jest.Mocked<typeof accountsQueries>;
const mockedTransactionsQueries = transactionsQueries as jest.Mocked<typeof transactionsQueries>;
const mockedSendNotification = sendNotification as jest.MockedFunction<typeof sendNotification>;

const createMockTransaction = () => ({
  one: jest.fn(),
  oneOrNone: jest.fn(),
  many: jest.fn(),
  manyOrNone: jest.fn(),
  none: jest.fn(),
  batch: jest.fn(),
  tx: jest.fn(),
});

describe("Loan Queries", () => {
  let originalLoanInterestRate: number;
  let originalMaxLoanableAmount: number;

  beforeAll(() => {
    originalLoanInterestRate = (loansQueries as any).loanInterestRate;
    originalMaxLoanableAmount = (loansQueries as any).maxLoanableAmount;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(loansQueries, 'loanInterestRate', {
      value: 0.01,
      writable: true,
      configurable: true
    });
    Object.defineProperty(loansQueries, 'maxLoanableAmount', {
      value: 1000000,
      writable: true,
      configurable: true
    });
  });

  afterAll(() => {
    Object.defineProperty(loansQueries, 'loanInterestRate', {
      value: originalLoanInterestRate,
      writable: true,
      configurable: true
    });
    Object.defineProperty(loansQueries, 'maxLoanableAmount', {
      value: originalMaxLoanableAmount,
      writable: true,
      configurable: true
    });
  });

  describe("createLoan", () => {
    it("should create loan successfully with valid parameters", async () => {
      mockedGetSimTime.mockReturnValue(1000);
      mockedDb.one.mockResolvedValue({ remaining: 0 });
      mockedAccountsQueries.getCommercialBankAccountNumber.mockResolvedValue("BANK123");
      mockedAccountsQueries.getAccountBalance.mockResolvedValue(100000);
      
      mockedTransactionsQueries.createTransaction.mockResolvedValue({
        transaction_id: 1,
        transaction_number: "TX001",
        status: "success",
        timestamp: 1000
      });

      const mockTx = createMockTransaction();
      mockTx.one.mockResolvedValue({
        loan_number: "LN001",
        initial_transaction_id: 1,
        interest_rate: 0.01,
        started_at: 1000,
        write_off: false
      });

      mockedDb.tx.mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      const result = await loansQueries.createLoan("ACC001", 50000);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.loan_number).toBe("LN001");
        expect(result.initial_transaction_id).toBe(1);
      }

      expect(mockedTransactionsQueries.createTransaction).toHaveBeenCalledWith(
        "ACC001", "BANK123", 50000, "Loan disbursement to ACC001"
      );
      expect(mockedSendNotification).toHaveBeenCalled();
    });

    it("should reject invalid loan amounts", async () => {
      const result = await loansQueries.createLoan("ACC001", 0);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("invalidLoanAmount");
      }
    });

    it("should reject loan exceeding individual cap", async () => {
      Object.defineProperty(loansQueries, 'maxLoanableAmount', {
        value: 1000,
        writable: true,
        configurable: true
      });
      mockedDb.one.mockResolvedValue({ remaining: 100 });
      const result = await loansQueries.createLoan("ACC001", 10000);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("loanTooLarge");
      }
    });

    it("should reject loan exceeding bank's cap", async () => {
      const result = await loansQueries.createLoan("ACC001", 2000000);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("loanTooLarge");
      }
    });
  });

  describe("getLoanIdFromNumber", () => {
    it("should return loan ID for valid loan number", async () => {
      mockedDb.oneOrNone.mockResolvedValue({ id: 123 });
      const result = await loansQueries.getLoanIdFromNumber("LN001");
      expect(result).toBe(123);
    });

    it("should return null for non-existent loan", async () => {
      mockedDb.oneOrNone.mockResolvedValue(null);
      const result = await loansQueries.getLoanIdFromNumber("INVALID");
      expect(result).toBeNull();
    });
  });

  describe("getTotalOutstandingLoansForAccount", () => {
    it("should calculate total outstanding loans correctly", async () => {
      mockedDb.one.mockResolvedValue({ remaining: 25000 });
      const result = await loansQueries.getTotalOutstandingLoansForAccount("ACC001");
      expect(result).toBe(25000);
    });

    it("should return 0 when no outstanding loans exist", async () => {
      mockedDb.one.mockResolvedValue({ remaining: 0 });
      const result = await loansQueries.getTotalOutstandingLoansForAccount("ACC001");
      expect(result).toBe(0);
    });
  });

  describe("repayLoan", () => {
    
    it("should reject invalid repayment amount", async () => {
      const result = await loansQueries.repayLoan("LN001", "ACC001", 0);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("invalidRepaymentAmount");
      }
    });

    it("should reject repayment for non-existent loan", async () => {
      const mockTx = createMockTransaction();
      mockedDb.tx.mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });
      mockedDb.oneOrNone.mockResolvedValue(null);

      const result = await loansQueries.repayLoan("INVALID", "ACC001", 10000);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("loanNotFound");
      }
    });
  });

  describe("getLoanDetails and Summary", () => {
    it("should return complete loan details with payment history", async () => {
      const mockSummary = {
        loan_number: "LN001",
        initial_amount: 50000,
        interest_rate: 0.01,
        started_at: 1000,
        write_off: false,
        outstanding_amount: 25000
      };

      const mockPayments = [
        { timestamp: 1500, amount: 10000, is_interest: false },
        { timestamp: 2000, amount: 15000, is_interest: false }
      ];

      mockedDb.oneOrNone.mockResolvedValue(mockSummary);
      mockedDb.manyOrNone.mockResolvedValue(mockPayments);

      const result = await loansQueries.getLoanDetails("LN001", "ACC001");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.loan_number).toBe("LN001");
        expect(result.payments).toHaveLength(2);
      }
    });

    it("should return error for non-existent loan details", async () => {
      mockedDb.oneOrNone.mockResolvedValue(null);
      const result = await loansQueries.getLoanDetails("INVALID", "ACC001");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("loanNotFound");
      }
    });

    it("should return all loan summaries for account", async () => {
      const mockSummaries = [
        {
          loan_number: "LN001",
          initial_amount: 50000,
          interest_rate: 0.01,
          started_at: 1000,
          write_off: false,
          outstanding_amount: 25000
        }
      ];

      mockedDb.manyOrNone.mockResolvedValue(mockSummaries);
      const result = await loansQueries.getLoanSummariesForAccount("ACC001");
      expect(result).toEqual(mockSummaries);
    });
  });

  describe("attemptInstalments", () => {
    it("should process instalments for accounts with sufficient funds", async () => {
      const mockTx = createMockTransaction();
      mockTx.manyOrNone
        .mockResolvedValueOnce([{ account_number: "ACC001" }])
        .mockResolvedValueOnce([
          {
            loan_number: "LN001",
            initial_amount: 50000,
            outstanding_amount: 30000,
            interest_rate: 0.02
          }
        ]);

      mockedDb.tx.mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      mockedAccountsQueries.getAccountBalance.mockResolvedValue(100000);
      
      const repayLoanSpy = jest.spyOn(loansQueries, 'repayLoan').mockResolvedValue({
        success: true,
        paid: 3000
      } as any);

      await loansQueries.attemptInstalments(0.10, 0.05);
      expect(repayLoanSpy).toHaveBeenCalled();
      repayLoanSpy.mockRestore();
    });

    it("should skip accounts with insufficient funds", async () => {
      const mockTx = createMockTransaction();
      mockTx.manyOrNone
        .mockResolvedValueOnce([{ account_number: "ACC001" }])
        .mockResolvedValueOnce([
          {
            loan_number: "LN001",
            initial_amount: 50000,
            outstanding_amount: 30000,
            interest_rate: 0.02
          }
        ]);

      mockedDb.tx.mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      mockedAccountsQueries.getAccountBalance.mockResolvedValue(1000);
      
      const repayLoanSpy = jest.spyOn(loansQueries, 'repayLoan').mockResolvedValue({
        success: true,
        paid: 3000
      } as any);

      await loansQueries.attemptInstalments(0.10, 0.05);
      expect(repayLoanSpy).not.toHaveBeenCalled();
      repayLoanSpy.mockRestore();
    });
  });

  describe("configuration", () => {
    it("should update loan interest rate and cap correctly", () => {
      loansQueries.setLoanInterestRate(0.02);
      loansQueries.setLoanCap(2000000);
      expect((loansQueries as any).loanInterestRate).toBe(0.02);
      expect((loansQueries as any).maxLoanableAmount).toBe(2000000);
    });
  });
});
