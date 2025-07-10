import express from 'express';
import transactionsRouter from './routes/transactions.routes';
import accountsRouter from './routes/accounts.router';
import TestingRouter from './routes/testing.router';
import loansRouter from './routes/loans.routes';
import { authMiddleware } from './middlewares/auth.middleware';
import SimulationRouter from './routes/thoh.routes';
import DashboardRouter from './routes/dashboard.routes'
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));


app.use('/api', authMiddleware, accountsRouter);
app.use('/api', authMiddleware, transactionsRouter);
app.use('/api', authMiddleware, loansRouter);
app.use('/api', authMiddleware, SimulationRouter);
app.use('/api/dashboard', DashboardRouter);
app.use('/testing', TestingRouter);


export default app;
