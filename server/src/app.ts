import express from 'express';
import transactionsRouter from './routes/transactios.routes';
import accountsRouter from './routes/accounts.router';

const app = express();
app.use(express.json());

app.use('/api', accountsRouter);
app.use('/api', transactionsRouter);

export default app;
