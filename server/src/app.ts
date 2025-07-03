import express from 'express';
import transactionsRouter from './routes/transactios.routes';
import accountsRouter from './routes/accounts.router';
import appConfig from './config/app.config';
import { authMiddleware } from './middlewares/auth.middleware';

const app = express();
app.use(express.json());

app.use('/api', authMiddleware , accountsRouter);
app.use('/api', authMiddleware, transactionsRouter);

app.get('/status', authMiddleware, (req, res) => {
  if (appConfig.isDev) {
    res.json({ status: 'ok', message: 'mTLS endpoint is working!'});
  }
});

app.get('/status-unauthed', (req, res) => {
  if (appConfig.isDev) {
    res.json({ status: 'ok', message: 'dashboard endpoint is working!'});
  }
});

export default app;
