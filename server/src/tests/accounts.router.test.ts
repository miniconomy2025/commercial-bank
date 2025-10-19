import request from 'supertest';
import app from '../app';
import db from '../config/db.config';

describe('accounts.router integration tests', () => {
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

  describe('POST /api/account', () => {
    it('should create account with valid team ID and notification URL', async () => {
      const response = await request(app)
        .post('/api/account')
        .set('client-id', 'test-team-001')
        .send({ notification_url: 'http://test.com/notify' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.account_number).toMatch(/^\d{12}$/);

      // Verify account was created in database
      const account = await db.oneOrNone(
        'SELECT team_id, notification_url FROM accounts WHERE account_number = $1',
        [response.body.account_number]
      );
      expect(account?.team_id).toBe('test-team-001');
      expect(account?.notification_url).toBe('http://test.com/notify');
    });

    it('should create account without notification URL', async () => {
      const response = await request(app)
        .post('/api/account')
        .set('client-id', 'test-team-002')
        .send({})
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.account_number).toMatch(/^\d{12}$/);
    });

    it('should return 409 for duplicate account creation', async () => {
      const response = await request(app)
        .post('/api/account')
        .set('client-id', 'team-001')
        .send({ notification_url: 'http://duplicate.com/notify' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('accountAlreadyExists');
    });

    it('should return 401 without client-id header', async () => {
      await request(app)
        .post('/api/account')
        .send({ notification_url: 'http://test.com/notify' })
        .expect(401);
    });
  });

  describe('GET /api/account/me', () => {
    it('should return account information for existing team', async () => {
      const response = await request(app)
        .get('/api/account/me')
        .set('client-id', 'team-001')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.account_number).toBeDefined();
      expect(response.body.notification_url).toBeDefined();
      expect(typeof response.body.net_balance).toBe('number');
    });

    it('should return 404 for non-existing team', async () => {
      const response = await request(app)
        .get('/api/account/me')
        .set('client-id', 'nonexistent-team')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('accountNotFound');
    });

    it('should return 401 without client-id header', async () => {
      await request(app)
        .get('/api/account/me')
        .expect(401);
    });
  });

  describe('GET /api/account/me/balance', () => {
    it('should return balance for existing account with transactions', async () => {
      const response = await request(app)
        .get('/api/account/me/balance')
        .set('client-id', 'team-001')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(typeof response.body.balance).toBe('number');
      expect(response.body.balance).toBe(900.75);
    });

    it('should return balance for account with negative balance', async () => {
      const response = await request(app)
        .get('/api/account/me/balance')
        .set('client-id', 'team-002')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.balance).toBe(-385.50);
    });

    it('should return 404 for non-existing account', async () => {
      const response = await request(app)
        .get('/api/account/me/balance')
        .set('client-id', 'nonexistent-team')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('accountNotFound');
    });

    it('should return 401 without client-id header', async () => {
      await request(app)
        .get('/api/account/me/balance')
        .expect(401);
    });
  });


});