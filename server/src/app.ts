import express from 'express';
import accountsRouter from './routes/accounts.router';

const app = express();

app.use('/api', accountsRouter);

export default app;
