import express from 'express';
import transactionsRouter from './routes/transactios.routes';
import accountsRouter from './routes/accounts.router';
import loansRouter from './routes/loans.routes'

const app = express();
app.use(express.json());

app.use('/api', accountsRouter);
app.use('/api', transactionsRouter);
app.use('/api', loansRouter);

export default app;
