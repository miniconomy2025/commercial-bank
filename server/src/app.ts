import express from 'express';
import transactionsRouter from './routes/transactions.routes';
import accountsRouter from './routes/accounts.router';
import loansRouter from './routes/loans.routes';
import { accountMiddleware, authMiddleware, dashboardMiddleware, simulationMiddleware } from './middlewares/auth.middleware';
import SimulationRouter from './routes/simulation.routes';
import DashboardRouter from './routes/dashboard.routes'
import interbankTransfer from './routes/interbank.routes';

const app = express();
app.use(express.json());

app.use('/api/account', authMiddleware, accountsRouter);
app.use('/api/transaction', authMiddleware, accountMiddleware, transactionsRouter);
app.use('/api/loan', authMiddleware, accountMiddleware, loansRouter);
app.use('/simulation', authMiddleware, simulationMiddleware,SimulationRouter);
app.use('/api/dashboard', dashboardMiddleware, DashboardRouter);
app.use('/api/interbank', authMiddleware, interbankTransfer);


export default app;
