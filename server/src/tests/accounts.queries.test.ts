import { createAccount, getAccountBalance, updateAccountNotificationUrl } from '../queries/accounts.queries';
import db from '../config/db.config';

describe('accounts.queries', () => {
  let dbAvailable = false;
  
  beforeAll(async () => {
    try {
      await db.oneOrNone('SELECT 1');
      dbAvailable = true;
    } catch (error) {
      console.warn('Database not available for testing, skipping database tests');
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      await db.$pool.end();
    }
  });

  beforeEach(() => {
    if (!dbAvailable) {
      pending('Database not available');
    }
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createAccount', () => {
    it('should create account with valid team ID', async () => {
      const result = await createAccount(1700000100, 'http://new-team.com/notify', 'new-team');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.account_number).toMatch(/^\d{12}$/);
        
        // Verify account was created in database
        const account = await db.oneOrNone(
          'SELECT team_id, notification_url FROM accounts WHERE account_number = $1',
          [result.account_number]
        );
        expect(account?.team_id).toBe('new-team');
        expect(account?.notification_url).toBe('http://new-team.com/notify');
      }
    });

    it('should handle duplicate account creation', async () => {
      const result = await createAccount(1700000101, 'http://duplicate.com/notify', 'team-001');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('accountAlreadyExists');
      }
    });
  });

  describe('getAccountBalance', () => {
    it('should return balance for existing account with transactions', async () => {
      const balance = await getAccountBalance('200000000001');
      expect(balance).toBe(900.75);
    });

    it('should return null for non-existing account', async () => {
      const balance = await getAccountBalance('999999999999');
      expect(balance).toBeNull();
    });

    it('should return negative balance for account with more outgoing', async () => {
      const balance = await getAccountBalance('200000000002');
      expect(balance).toBe(-385.50);
    });

    it('should return zero balance for account with no transactions', async () => {
      // Create a new account with no transactions
      const createResult = await createAccount(1700000102, 'http://test.com/notify', 'test-zero-balance');
      if (createResult.success) {
        const balance = await getAccountBalance(createResult.account_number);
        expect(balance).toBe(0);
      }
    });
  });

  describe('updateAccountNotificationUrl', () => {
    it('should update notification URL with valid URL', async () => {
      await updateAccountNotificationUrl('team-001', 'https://updated-url.com/webhook');

      // Verify the URL was updated in database
      const account = await db.oneOrNone(
        'SELECT notification_url FROM accounts WHERE team_id = $1',
        ['team-001']
      );
      expect(account?.notification_url).toBe('https://updated-url.com/webhook');
    });

    it('should update with HTTP URL', async () => {
      await updateAccountNotificationUrl('team-002', 'http://localhost:3000/notify');

      // Verify the URL was updated in database
      const account = await db.oneOrNone(
        'SELECT notification_url FROM accounts WHERE team_id = $1',
        ['team-002']
      );
      expect(account?.notification_url).toBe('http://localhost:3000/notify');
    });

    it('should handle non-existing team ID', async () => {
      // This should not throw an error, just update 0 rows
      await expect(updateAccountNotificationUrl('nonexistent-team', 'http://example.com'))
        .resolves.not.toThrow();

      // Verify no account was affected
      const account = await db.oneOrNone(
        'SELECT notification_url FROM accounts WHERE team_id = $1',
        ['nonexistent-team']
      );
      expect(account).toBeNull();
    });
  });
});