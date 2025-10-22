import request from 'supertest';
import app from '../app';
import db from '../config/db.config';
import { chargeInterest } from '../queries/loans.queries';

describe('Balance Validation Tests', () => {
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

  describe('Balance validation through interest charges', () => {
    it('should prevent interest charge when it would cause negative balance', async () => {
      // Create account and take loan
      await request(app)
        .post('/api/account')
        .send({
          notification_url: 'https://test-balance-interest.example.com/notify'
        })
        .set('client-id', 'test-balance-interest');

      const loanResponse = await request(app)
        .post('/api/loan')
        .set('client-id', 'test-balance-interest')
        .send({ amount: 1000 });

      // Drain account balance to zero
      const balanceResponse = await request(app)
        .get('/api/account/me')
        .set('client-id', 'test-balance-interest');
      
      const currentBalance = balanceResponse.body.net_balance;

      await request(app)
        .post('/api/transaction')
        .set('client-id', 'test-balance-interest')
        .send({
          to_account_number: '200000000001',
          to_bank_name: 'commercial-bank',
          amount: currentBalance,
          description: 'Drain balance for test'
        });

      // Attempt interest charge - should handle insufficient funds gracefully
      await chargeInterest();

      // Check if loan was written off due to insufficient funds for interest
      const loanDetails = await db.oneOrNone(`
        SELECT write_off FROM loans WHERE loan_number = $1
      `, [loanResponse.body.loan_number]);

      // Loan should be written off when interest cannot be charged
      expect(loanDetails?.write_off).toBe(true);

      // Verify balance is still zero (no negative balance created)
      const finalBalance = await request(app)
        .get('/api/account/me')
        .set('client-id', 'test-balance-interest');
      
      expect(finalBalance.body.net_balance).toBe(0);
    });
  });

  describe('Balance validation through loan repayment', () => {
    it('should reject loan repayment when it would cause negative balance', async () => {
      // Create account and take loan
      await request(app)
        .post('/api/account')
        .send({
          notification_url: 'https://test-balance-repay.example.com/notify'
        })
        .set('client-id', 'test-balance-repay');

      const loanResponse = await request(app)
        .post('/api/loan')
        .set('client-id', 'test-balance-repay')
        .send({ amount: 1000 });

      const loanNumber = loanResponse.body.loan_number;

      // Drain account balance to zero
      const balanceResponse = await request(app)
        .get('/api/account/me')
        .set('client-id', 'test-balance-repay');
      
      const currentBalance = balanceResponse.body.net_balance;

      await request(app)
        .post('/api/transaction')
        .set('client-id', 'test-balance-repay')
        .send({
          to_account_number: '200000000001',
          to_bank_name: 'commercial-bank',
          amount: currentBalance,
          description: 'Drain balance for test'
        });

      // Attempt loan repayment that would cause negative balance
      const repaymentResponse = await request(app)
        .post(`/api/loan/${loanNumber}/pay`)
        .set('client-id', 'test-balance-repay')
        .send({ amount: 100 })
        .expect(422);

      expect(repaymentResponse.body.success).toBe(false);
      expect(repaymentResponse.body.error).toBe('paymentNotPermitted');

      // Verify balance is still zero
      const finalBalanceResponse = await request(app)
        .get('/api/account/me')
        .set('client-id', 'test-balance-repay');

      expect(finalBalanceResponse.body.net_balance).toBe(0);
    });
  });

  describe('Balance validation through transaction creation', () => {
    it('should reject transaction when it would cause negative balance', async () => {
      // Create account and take loan
      await request(app)
        .post('/api/account')
        .send({
          notification_url: 'https://test-balance-tx.example.com/notify'
        })
        .set('client-id', 'test-balance-tx');

      await request(app)
        .post('/api/loan')
        .set('client-id', 'test-balance-tx')
        .send({ amount: 1000 });

      // Get current balance
      const balanceResponse = await request(app)
        .get('/api/account/me')
        .set('client-id', 'test-balance-tx');
      
      const currentBalance = balanceResponse.body.net_balance;

      // Attempt transaction that exceeds balance
      const transactionResponse = await request(app)
        .post('/api/transaction')
        .set('client-id', 'test-balance-tx')
        .send({
          to_account_number: '200000000001',
          to_bank_name: 'commercial-bank',
          amount: currentBalance + 100,
          description: 'Overdraft attempt'
        })
        .expect(422);

      expect(transactionResponse.body.success).toBe(false);
      expect(transactionResponse.body.error).toBe('insufficientFunds');

      // Verify balance unchanged
      const finalBalanceResponse = await request(app)
        .get('/api/account/me')
        .set('client-id', 'test-balance-tx');

      expect(finalBalanceResponse.body.net_balance).toBe(currentBalance);
    });

    it('should allow transaction that reduces balance to exactly zero', async () => {
      // Create account and take loan
      await request(app)
        .post('/api/account')
        .send({
          notification_url: 'https://test-balance-zero.example.com/notify'
        })
        .set('client-id', 'test-balance-zero');

      await request(app)
        .post('/api/loan')
        .set('client-id', 'test-balance-zero')
        .send({ amount: 1000 });

      // Get current balance
      const balanceResponse = await request(app)
        .get('/api/account/me')
        .set('client-id', 'test-balance-zero');
      
      const currentBalance = balanceResponse.body.net_balance;

      // Transaction that reduces balance to exactly zero
      const transactionResponse = await request(app)
        .post('/api/transaction')
        .set('client-id', 'test-balance-zero')
        .send({
          to_account_number: '200000000001',
          to_bank_name: 'commercial-bank',
          amount: currentBalance,
          description: 'Zero balance test'
        })
        .expect(200);

      expect(transactionResponse.body.success).toBe(true);

      // Verify balance is now zero
      const finalBalanceResponse = await request(app)
        .get('/api/account/me')
        .set('client-id', 'test-balance-zero');

      expect(finalBalanceResponse.body.net_balance).toBe(0);
    });
  });
});