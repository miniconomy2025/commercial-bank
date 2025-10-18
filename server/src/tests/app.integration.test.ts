import request from 'supertest';
import express from 'express';

const app = express();
app.get('/health', (req, res) => {
  res.status(200).json({ success: true });
});

describe('App Integration', () => {
  test('GET /health should return 200', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toEqual({ success: true });
  });
});