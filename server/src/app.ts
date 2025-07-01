import express from 'express';
import accountsRouter from './routes/accounts.router';
import loanRouter from './routes/loans.router';

const app = express();
app.use(express.json());

app.use('/api', accountsRouter);
app.use('/api',loanRouter)

export default app;
