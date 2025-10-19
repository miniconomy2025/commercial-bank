import request from 'supertest';
import app from '../app';
import db from '../config/db.config';

describe('interbank.router integration tests', () => {
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
  });

  describe('POST /api/interbank/transfer', () => {
    it('should process valid interbank transfer', async () => {
      const transferData = {
        transaction_number: 'TXN-TEST-001',
        from_bank_name: 'retail-bank',
        from_account_number: '100000000001',
        to_account_number: '200000000001',
        amount: 100.00,
        description: 'Test interbank transfer'
      };

      const response = await request(app)
        .post('/api/interbank/transfer')
        .set('client-id', 'retail-bank')
        .send(transferData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteData = {
        transaction_number: 'TXN-TEST-002',
        from_bank_name: 'retail-bank',
        // Missing other required fields
      };

      const response = await request(app)
        .post('/api/interbank/transfer')
        .set('client-id', 'retail-bank')
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('invalidPayload');
    });

    it('should return 409 for duplicate transaction number', async () => {
      const transferData = {
        transaction_number: 'TXN-DUPLICATE-001',
        from_bank_name: 'retail-bank',
        from_account_number: '100000000001',
        to_account_number: '200000000001',
        amount: 50.00,
        description: 'Duplicate transaction test'
      };

      // First transfer should succeed
      await request(app)
        .post('/api/interbank/transfer')
        .set('client-id', 'retail-bank')
        .send(transferData)
        .expect(200);

      // Second transfer with same transaction number should fail
      const response = await request(app)
        .post('/api/interbank/transfer')
        .set('client-id', 'retail-bank')
        .send(transferData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('duplicateTransactionNumber');
    });

    it('should return 403 for unauthorized team', async () => {
      const transferData = {
        transaction_number: 'TXN-TEST-003',
        from_bank_name: 'retail-bank',
        from_account_number: '100000000001',
        to_account_number: '200000000001',
        amount: 100.00,
        description: 'Test transfer'
      };

      const response = await request(app)
        .post('/api/interbank/transfer')
        .set('client-id', 'unauthorized-team')
        .send(transferData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('transferNotPermitted');
    });

    it('should return 401 without client-id header', async () => {
      const transferData = {
        transaction_number: 'TXN-TEST-004',
        from_bank_name: 'retail-bank',
        from_account_number: '100000000001',
        to_account_number: '200000000001',
        amount: 100.00,
        description: 'Test transfer'
      };

      await request(app)
        .post('/api/interbank/transfer')
        .send(transferData)
        .expect(401);
    });
  });
});