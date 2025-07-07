import express from 'express';
import transactionsRouter from './routes/transactios.routes';
import accountsRouter from './routes/accounts.router';
import TestingRouter from './routes/testing.router';
import loansRouter from './routes/loans.routes';
import { authMiddleware } from './middlewares/auth.middleware';
import appConfig from './config/app.config';
import SimulationRouter from './routes/simulation.routes';

const app = express();
app.use(express.json());

app.use('/api', accountsRouter);
app.use('/api', authMiddleware, transactionsRouter);
app.use('/api', authMiddleware, loansRouter);
app.use('/api', authMiddleware, SimulationRouter);
if (appConfig.isDev) {
  app.use('/testing', TestingRouter);
}


export default app;
