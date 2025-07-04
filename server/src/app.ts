import express from 'express';
import transactionsRouter from './routes/transactios.routes';
import accountsRouter from './routes/accounts.router';
import loansRouter from './routes/loans.routes'
import TestingRouter from './routes/testing.router';
import { authMiddleware } from './middlewares/auth.middleware';
import appConfig from './config/app.config';

const app = express();
app.use(express.json());

app.use('/api', accountsRouter);
app.use('/api', transactionsRouter);
app.use('/api', loansRouter);
app.use('/api', authMiddleware , accountsRouter);
app.use('/api', authMiddleware, transactionsRouter);
if (appConfig.isDev) {
  app.use('/testing', TestingRouter);
}


export default app;
