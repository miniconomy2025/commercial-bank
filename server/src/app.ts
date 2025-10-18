import express from 'express';
import cors from 'cors';
import transactionsRouter from './routes/transactions.routes';
import accountsRouter from './routes/accounts.router';
import loansRouter from './routes/loans.routes';
import { accountMiddleware, authMiddleware, dashboardMiddleware, simulationMiddleware } from './middlewares/auth.middleware';
import SimulationRouter from './routes/simulation.routes';
import DashboardRouter from './routes/dashboard.routes'
import interbankTransfer from './routes/interbank.routes';

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, status: 'ok' });
});
app.use(authMiddleware);
app.use('/api/account', accountsRouter);
app.use('/api/transaction', accountMiddleware, transactionsRouter);
app.use('/api/loan', accountMiddleware, loansRouter);
app.use('/simulation', simulationMiddleware,SimulationRouter);
app.use('/api/dashboard', dashboardMiddleware, DashboardRouter);
app.use('/api/interbank', interbankTransfer);


export default app;
