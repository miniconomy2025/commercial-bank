import { 
  getAllTransactions, 
  getTransactionStatusId, 
  createTransaction,
  getTransactionById,
} from "../queries/transactions.queries";
import { getAccountBalance } from "../queries/accounts.queries";
import db from "../config/db.config";

describe("Transactions queries", () => {

  let dbAvailable = false;
  
  beforeAll(async () => {
    try {
      await db.oneOrNone('SELECT 1');
      dbAvailable = true;
    }
    catch (error) { console.warn('Database not available for testing, skipping database tests'); }
  });

  afterAll(async () => {
    if (dbAvailable) { await db.$pool.end(); }
  });

  beforeEach(() => {
    if (!dbAvailable) { pending('Database not available'); }
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("createTransaction", () => {

    it("should create a transaction between two accounts with positive balances", async () => {
      if(!dbAvailable) return;
      
      const accountOneBeforeBalance = await getAccountBalance('200000000001');
      const accountTwoBeforeBalance = await getAccountBalance('200000000003');

      // Get account balance for the two accounts and check balances after the transaction
      const result = await createTransaction('200000000003', '200000000001', 25, "Test transaction", "commercial-bank", "commercial-bank");

      // Get balances after transaction
      const accountOneAfterBalance = await getAccountBalance('200000000001');
      const accountTwoAfterBalance = await getAccountBalance('200000000003');
      
      const validBalances: boolean = !!accountOneBeforeBalance && !!accountTwoBeforeBalance && !!accountOneAfterBalance && !!accountTwoBeforeBalance

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe('success');
      if(validBalances) {
        expect(accountOneBeforeBalance! - accountOneAfterBalance!).toBe(25);
        expect(accountTwoAfterBalance! - accountTwoBeforeBalance!).toBe(25);
      }
      expect(Object.keys(result).length).toBeGreaterThan(0);
    });

    it("should not create a transaction when sender has a less money than transaction amount", async () => {
      if(!dbAvailable) return;
      
      const accountOneBeforeBalance = await getAccountBalance('200000000001');
      const accountTwoBeforeBalance = await getAccountBalance('200000000002');

      // Get account balance for the two accounts and check balances after the transaction
      const result = await createTransaction('200000000001', '200000000002', 1000, "Test transaction", "commercial-bank", "commercial-bank");
      const resultKeys = Object.keys(result);

    });

    it("should not create a transaction when sender has a less money than transaction amount", async () => {
      if(!dbAvailable) return;
      
      const accountOneBeforeBalance = await getAccountBalance('200000000001');
      const accountTwoBeforeBalance = await getAccountBalance('200000000001');

      // Get account balance for the two accounts and check balances after the transaction
      const result = await createTransaction('200000000001', '200000000001', 25, "Test transaction", "commercial-bank", "commercial-bank");

      
    });
  })
  
  describe("getAllTransactions", () => {
    it("get all transactions between account numbers", async () => {

      if(!dbAvailable) return;

      const result = await getAllTransactions('200000000002', '200000000001');

      // Assert
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it("get all transactions between non existent accounts", async () => {

      if(!dbAvailable) return;

      const result = await getAllTransactions('200000000100', '200000000200');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(0)
    });
  })

  describe("getTransactionStatusId", () => {
    it("should return an Ids of statuses allowed in our application", async () => {

      if(!dbAvailable) return;

      const result = await db.one("SELECT id FROM transaction_statuses WHERE name = 'success'");

      const success = await getTransactionStatusId('success');
      const invalidStatus = await getTransactionStatusId('invalidStatus');
      expect(success).toBeDefined();
      expect(success).toBe(result.id);
      expect(invalidStatus).toBeNull();
    });
  })

  describe("getTransactionById", () => {
    it("should return an Id of an existing transaction", async () => {
      if(!dbAvailable) return;

      const validTransaction = await getTransactionById('TXN000000001');
      const noneExistentTransaction = await getTransactionById('TXN000001000');

      expect(validTransaction).toBeDefined();
      expect(Object.keys(validTransaction!).length).toBeGreaterThan(0);
      expect(noneExistentTransaction).toBeNull();
    });
  })
});



