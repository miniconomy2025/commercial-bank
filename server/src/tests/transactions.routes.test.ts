import request from 'supertest';
import app from '../app';
import db from '../config/db.config';
import { execSync } from 'child_process';

describe('transactions.routes integration tests', () => {
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
  });

  describe('POST /api/transaction - Transaction processing with balance updates', () => {
    it('should process valid transaction and update balances', async () => {
      const transactionData = {
        to_account_number: '200000000002',
        to_bank_name: 'commercial-bank',
        amount: 50.00,
        description: 'Test transaction'
      };

      const response = await request(app)
        .post('/api/transaction')
        .set('client-id', 'team-001')
        .send(transactionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.transaction_number).toBeDefined();
      expect(response.body.status).toBe('success');
    });

    it('should reject transaction with insufficient funds', async () => {
      const transactionData = {
        to_account_number: '200000000002',
        to_bank_name: 'commercial-bank',
        amount: 10000.00,
        description: 'Large transaction'
      };

      const response = await request(app)
        .post('/api/transaction')
        .set('client-id', 'team-001')
        .send(transactionData)
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('insufficientFunds');
    });

    it('should reject transaction to non-existent account', async () => {
      const transactionData = {
        to_account_number: '999999999999',
        to_bank_name: 'commercial-bank',
        amount: 10.00,
        description: 'Test transaction'
      };

      const response = await request(app)
        .post('/api/transaction')
        .set('client-id', 'team-001')
        .send(transactionData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('accountNotFound');
    });

    it('should reject transaction to same account', async () => {
      const response = await request(app)
        .get('/api/account/me')
        .set('client-id', 'team-001');

      const transactionData = {
        to_account_number: response.body.account_number,
        to_bank_name: 'commercial-bank',
        amount: 10.00,
        description: 'Self transaction'
      };

      const transactionResponse = await request(app)
        .post('/api/transaction')
        .set('client-id', 'team-001')
        .send(transactionData)
        .expect(400);

      expect(transactionResponse.body.success).toBe(false);
      expect(transactionResponse.body.error).toBe('invalidPayload');
    });

    it('should reject transaction with invalid amount', async () => {
      const transactionData = {
        to_account_number: '200000000001',
        to_bank_name: 'commercial-bank',
        amount: -10.00,
        description: 'Negative amount'
      };

      const response = await request(app)
        .post('/api/transaction')
        .set('client-id', 'team-001')
        .send(transactionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('invalidPayload');
    });

    it('should process interbank transaction to THOH', async () => {
      const transactionData = {
        to_account_number: '300000000001',
        to_bank_name: 'thoh',
        amount: 25.00,
        description: 'Interbank transfer'
      };

      const response = await request(app)
        .post('/api/transaction')
        .set('client-id', 'team-001')
        .send(transactionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.transaction_number).toBeDefined();
    });
  });

  describe('GET /api/transaction - Transaction history with filtering', () => {
    it('should return transaction history for account', async () => {
      const response = await request(app)
        .get('/api/transaction')
        .set('client-id', 'team-001')
        .query({ to: '200000000001' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.transactions)).toBe(true);
      
      if (response.body.transactions.length > 0) {
        const transaction = response.body.transactions[0];
        expect(transaction).toHaveProperty('transaction_number');
        expect(transaction).toHaveProperty('from');
        expect(transaction).toHaveProperty('to');
        expect(transaction).toHaveProperty('amount');
        expect(transaction).toHaveProperty('description');
        expect(transaction).toHaveProperty('status');
        expect(transaction).toHaveProperty('timestamp');
      }
    });

    it('should filter transactions by successful status only', async () => {
      const response = await request(app)
        .get('/api/transaction')
        .set('client-id', 'team-001')
        .query({ 
          to: '200000000001',
          onlySuccessful: 'true'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.transactions)).toBe(true);
      
      response.body.transactions.forEach((transaction: any) => {
        expect(transaction.status).toBe('success');
      });
    });

    it('should return empty array for non-existent account pair', async () => {
      const response = await request(app)
        .get('/api/transaction')
        .set('client-id', 'team-001')
        .query({ to: '999999999999' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.transactions).toEqual([]);
    });

    it('should return 401 without client-id header', async () => {
      await request(app)
        .get('/api/transaction')
        .query({ to: '200000000001' })
        .expect(401);
    });
  });

  describe('GET /api/transaction/:id - Get specific transaction', () => {
    it('should return specific transaction by ID', async () => {
      // First create a transaction to get its ID
      const transactionData = {
        to_account_number: '200000000010',
        to_bank_name: 'commercial-bank',
        amount: 15.00,
        description: 'Test for retrieval'
      };

      const createResponse = await request(app)
        .post('/api/transaction')
        .set('client-id', 'team-003')
        .send(transactionData);

      const transactionId = createResponse.body.transaction_number;

      const response = await request(app)
        .get(`/api/transaction/${transactionId}`)
        .set('client-id', 'team-003')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.transaction.transaction_number).toBe(transactionId);
      expect(response.body.transaction.amount).toBe(15.00);
      expect(response.body.transaction.description).toBe('Test for retrieval');
    });

    it('should return 404 for non-existent transaction', async () => {
      const response = await request(app)
        .get('/api/transaction/NON-EXISTENT-ID')
        .set('client-id', 'team-001')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('transactionNotFound');
    });
  });
});