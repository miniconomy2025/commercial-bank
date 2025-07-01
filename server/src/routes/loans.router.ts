import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { get } from 'http';
import { createLoan, createLoanPayment, getLoans } from '../queries/loans.queries';

const router = Router();

router.get('/loan', async (req: Request, res: Response) => {
  try {
    const  loan_number  = typeof(req.query.loan_number) === 'string' ? req.query.loan_number  : undefined;
    const loans = await getLoans(loan_number);
    res.status(200).json(loans);
  } catch (error) {
    logger.error('Error fetching loans:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/loan', async (req: Request, res: Response) => {
  try {
    const {to,  amount, interest_rate, started_at } = req.body;
    const transaction = await createTransaction();
    const  loan = await createLoan(transaction.transaction_number, to, interest_rate, started_at);
    res.status(200).json({success: true, loan_number: loan.loan_number});
  } catch (error) {
    logger.error('Error fetching loans:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/loan/loan_payment/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const isInterest = req.body.isInterest === 'true';
    const transaction = await createTransaction(amount);
    const loanPayment = await createLoanPayment(Number.parseInt(id), transaction.transaction_number, amount, isInterest);

    res.status(200).json();
  } catch (error) {
    logger.error('Error fetching loans:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
