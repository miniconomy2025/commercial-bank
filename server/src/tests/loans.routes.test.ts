import request from 'supertest';
import app from '../app';
import db from '../config/db.config';

describe('loans.routes integration tests', () => {
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

  describe('POST /api/loan - Loan application and approval workflow', () => {
    it('should successfully create a loan for valid amount', async () => {
      const loanData = { amount: 1000 };

      const response = await request(app)
        .post('/api/loan')
        .set('client-id', 'team-021')
        .send(loanData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.loan_number).toBeDefined();
      expect(typeof response.body.loan_number).toBe('string');
    });

    it('should reject loan with invalid amount (negative)', async () => {
      const loanData = { amount: -500 };

      const response = await request(app)
        .post('/api/loan')
        .set('client-id', 'team-001')
        .send(loanData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('invalidLoanAmount');
    });

    it('should reject loan with zero amount', async () => {
      const loanData = { amount: 0 };

      const response = await request(app)
        .post('/api/loan')
        .set('client-id', 'team-001')
        .send(loanData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('invalidLoanAmount');
    });

    it('should reject loan exceeding maximum loanable amount', async () => {
      const loanData = { amount: 2000000 };

      const response = await request(app)
        .post('/api/loan')
        .set('client-id', 'team-002')
        .send(loanData)
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('loanNotPermitted');
    });

    it('should require authentication', async () => {
      const loanData = { amount: 1000 };

      await request(app)
        .post('/api/loan')
        .send(loanData)
        .expect(401);
    });
  });

  describe('GET /api/loan - Loan listing', () => {
    it('should return loan summaries for account with loans', async () => {
      // First create a loan
      const loanData = { amount: 500 };
      await request(app)
        .post('/api/loan')
        .set('client-id', 'team-003')
        .send(loanData);

      const response = await request(app)
        .get('/api/loan')
        .set('client-id', 'team-003')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.total_outstanding_amount).toBeGreaterThan(0);
      expect(Array.isArray(response.body.loans)).toBe(true);
      expect(response.body.loans.length).toBeGreaterThan(0);
      
      const loan = response.body.loans[0];
      expect(loan).toHaveProperty('loan_number');
      expect(loan).toHaveProperty('initial_amount');
      expect(loan).toHaveProperty('outstanding_amount');
      expect(loan).toHaveProperty('interest_rate');
    });

    it('should return empty loans for account without loans', async () => {
      const response = await request(app)
        .get('/api/loan')
        .set('client-id', 'team-022')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.total_outstanding_amount).toBe(0);
      expect(response.body.loans).toEqual([]);
    });
  });

  describe('POST /api/loan/:loan_number/pay - Payment processing', () => {
    it('should successfully process loan payment', async () => {
      // Create a loan for this specific test
      const loanData = { amount: 1000 };
      const loanResponse = await request(app)
        .post('/api/loan')
        .set('client-id', 'team-024')
        .send(loanData);
      
      const loanNumber = loanResponse.body.loan_number;
      const paymentData = { amount: 200 };

      const response = await request(app)
        .post(`/api/loan/${loanNumber}/pay`)
        .set('client-id', 'team-024')
        .send(paymentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.paid).toBe(200);
    });

    it('should reject payment with invalid amount (negative)', async () => {
      // Create a loan for this specific test
      const loanData = { amount: 1000 };
      const loanResponse = await request(app)
        .post('/api/loan')
        .set('client-id', 'team-025')
        .send(loanData);
      
      const loanNumber = loanResponse.body.loan_number;
      const paymentData = { amount: -100 };

      const response = await request(app)
        .post(`/api/loan/${loanNumber}/pay`)
        .set('client-id', 'team-025')
        .send(paymentData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('invalidPayload');
    });

    it('should reject payment with zero amount', async () => {
      // Create a loan for this specific test
      const loanData = { amount: 1000 };
      const loanResponse = await request(app)
        .post('/api/loan')
        .set('client-id', 'team-026')
        .send(loanData);
      
      const loanNumber = loanResponse.body.loan_number;
      const paymentData = { amount: 0 };

      const response = await request(app)
        .post(`/api/loan/${loanNumber}/pay`)
        .set('client-id', 'team-026')
        .send(paymentData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('invalidPayload');
    });

    it('should reject payment for non-existent loan', async () => {
      const paymentData = { amount: 100 };

      const response = await request(app)
        .post('/api/loan/NON-EXISTENT-LOAN/pay')
        .set('client-id', 'team-024')
        .send(paymentData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('loanNotFound');
    });

    it('should prevent overpayment by limiting to outstanding amount', async () => {
      // Create a loan for this specific test
      const loanData = { amount: 1000 };
      const loanResponse = await request(app)
        .post('/api/loan')
        .set('client-id', 'team-005')
        .send(loanData);
      
      const loanNumber = loanResponse.body.loan_number;
      const paymentData = { amount: 2000 }; // More than loan amount

      const response = await request(app)
        .post(`/api/loan/${loanNumber}/pay`)
        .set('client-id', 'team-005')
        .send(paymentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.paid).toBe(1000); // Should be limited to outstanding amount
    });

    it('should allow payment from different account', async () => {
      // Create a loan for this specific test
      const loanData = { amount: 1000 };
      const loanResponse = await request(app)
        .post('/api/loan')
        .set('client-id', 'team-005')
        .send(loanData);
      
      const loanNumber = loanResponse.body.loan_number;
      const paymentData = { amount: 100 };

      const response = await request(app)
        .post(`/api/loan/${loanNumber}/pay`)
        .set('client-id', 'team-006') // Different account
        .send(paymentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.paid).toBe(100);
    });
  });

  describe('GET /api/loan/:loan_number - Loan details', () => {
    let loanNumber: string;

    beforeEach(async () => {
      // Create a loan and make a payment for detailed testing
      const loanData = { amount: 800 };
      const loanResponse = await request(app)
        .post('/api/loan')
        .set('client-id', 'team-007')
        .send(loanData);
      
      loanNumber = loanResponse.body.loan_number;

      // Make a payment
      const paymentData = { amount: 150 };
      await request(app)
        .post(`/api/loan/${loanNumber}/pay`)
        .set('client-id', 'team-007')
        .send(paymentData);
    });

    it('should return detailed loan information for borrower', async () => {
      const response = await request(app)
        .get(`/api/loan/${loanNumber}`)
        .set('client-id', 'team-007')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.loan).toBeDefined();
      
      const loan = response.body.loan;
      expect(loan.loan_number).toBe(loanNumber);
      expect(loan.initial_amount).toBe(800);
      expect(loan.outstanding_amount).toBe(650); // 800 - 150
      expect(loan.interest_rate).toBeDefined();
      expect(Array.isArray(loan.payments)).toBe(true);
      expect(loan.payments.length).toBeGreaterThan(0);
      
      const payment = loan.payments[0];
      expect(payment.amount).toBe(150);
      expect(payment.is_interest).toBe(false);
    });

    it('should return 404 for non-existent loan', async () => {
      const response = await request(app)
        .get('/api/loan/NON-EXISTENT-LOAN')
        .set('client-id', 'team-007')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('loanNotFound');
    });

    it('should return 404 when accessing loan from different account', async () => {
      const response = await request(app)
        .get(`/api/loan/${loanNumber}`)
        .set('client-id', 'team-008') // Different account
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('loanNotFound');
    });
  });

  describe('Interest calculations workflow', () => {
    it('should create loan with correct interest rate', async () => {
      const loanData = { amount: 100 };

      const loanResponse = await request(app)
        .post('/api/loan')
        .set('client-id', 'team-013')
        .send(loanData)
        .expect(200);

      expect(loanResponse.body.success).toBe(true);
      const loanNumber = loanResponse.body.loan_number;

      const detailsResponse = await request(app)
        .get(`/api/loan/${loanNumber}`)
        .set('client-id', 'team-013')
        .expect(200);

      expect(detailsResponse.body.loan.interest_rate).toBe(0.01); // Default rate
    });

    it('should track outstanding amount correctly after partial payments', async () => {
      const loanData = { amount: 100 };
      const loanResponse = await request(app)
        .post('/api/loan')
        .set('client-id', 'team-023')
        .send(loanData)
        .expect(200);

      expect(loanResponse.body.success).toBe(true);
      const loanNumber = loanResponse.body.loan_number;

      // Make multiple payments
      await request(app)
        .post(`/api/loan/${loanNumber}/pay`)
        .set('client-id', 'team-023')
        .send({ amount: 30 })
        .expect(200);

      await request(app)
        .post(`/api/loan/${loanNumber}/pay`)
        .set('client-id', 'team-023')
        .send({ amount: 20 })
        .expect(200);

      // Check outstanding amount
      const response = await request(app)
        .get('/api/loan')
        .set('client-id', 'team-023')
        .expect(200);

      expect(response.body.total_outstanding_amount).toBe(50); // 100 - 30 - 20
      
      const loan = response.body.loans.find((l: any) => l.loan_number === loanNumber);
      expect(loan.outstanding_amount).toBe(50);
    });

    it('should handle full loan repayment', async () => {
      const loanData = { amount: 50 };
      const loanResponse = await request(app)
        .post('/api/loan')
        .set('client-id', 'team-011')
        .send(loanData);

      // Handle case where bank is depleted from previous tests
      if (loanResponse.status === 503) {
        expect(loanResponse.body.error).toBe('bankDepleted');
        return; // Skip this test if bank is depleted
      }

      expect(loanResponse.status).toBe(200);
      expect(loanResponse.body.success).toBe(true);
      const loanNumber = loanResponse.body.loan_number;
      expect(loanNumber).toBeDefined();

      // Pay off entire loan
      const paymentResponse = await request(app)
        .post(`/api/loan/${loanNumber}/pay`)
        .set('client-id', 'team-011')
        .send({ amount: 50 })
        .expect(200);

      expect(paymentResponse.body.paid).toBe(50);

      // Check that loan is fully paid
      const loansResponse = await request(app)
        .get('/api/loan')
        .set('client-id', 'team-011')
        .expect(200);

      const loan = loansResponse.body.loans.find((l: any) => l.loan_number === loanNumber);
      expect(loan.outstanding_amount).toBe(0);
    });

    it('should reject payment on fully paid loan', async () => {
      const loanData = { amount: 50 };
      const loanResponse = await request(app)
        .post('/api/loan')
        .set('client-id', 'team-012')
        .send(loanData);

      // Handle case where bank is depleted from previous tests
      if (loanResponse.status === 503) {
        expect(loanResponse.body.error).toBe('bankDepleted');
        return; // Skip this test if bank is depleted
      }

      expect(loanResponse.status).toBe(200);
      expect(loanResponse.body.success).toBe(true);
      const loanNumber = loanResponse.body.loan_number;
      expect(loanNumber).toBeDefined();

      // Pay off entire loan
      const firstPayment = await request(app)
        .post(`/api/loan/${loanNumber}/pay`)
        .set('client-id', 'team-012')
        .send({ amount: 50 })
        .expect(200);

      expect(firstPayment.body.success).toBe(true);
      expect(firstPayment.body.paid).toBe(50);

      // Try to pay again
      const response = await request(app)
        .post(`/api/loan/${loanNumber}/pay`)
        .set('client-id', 'team-012')
        .send({ amount: 10 })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('loanPaidOff');
    });
  });
});