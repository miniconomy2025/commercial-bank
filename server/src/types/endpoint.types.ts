//-------------------- Generic Base Types --------------------//
// Result type for API responses

import { SimTime } from "../utils/time";

export type Unit = { [K in never]: never };

// Handles success & specific data for individual failure cases
export type Result<
  S extends object,                                             // Success payload type
  E extends { [key: string]: object } = Unit,                   // Error payload type, for each error string
  Es extends string = keyof E extends string ? keyof E : never, // Possible error strings
> =
  | ({ success: true } & S)
  | ({ [K in keyof E]: { success: false; error: K } & E[K] }[Es]);

// Simple result, no error payload
export type SimpleResult<S extends object, Es extends string> = Result<S, { [K in Es]: Unit }>;

//-------------------- Generic Base Types --------------------//
export type BankId = "commercial-bank" | "retail-bank" | "thoh";


//-------------------- /account --------------------//

export type AccountInfo = { net_balance: number; account_number: string; notification_url: string; };

// POST /account
export type Post_Account_Req = { notification_url?: string; };
export type Post_Account_Res = SimpleResult<
    { account_number: string },
    "invalidPayload" | "accountAlreadyExists" | "internalError"
>;

// GET /account/me
export type Get_AccountMe_Req = {};
export type Get_AccountMe_Res = SimpleResult<
    AccountInfo,
    "accountNotFound" | "internalError"
>;

// POST /account/me/notify
export type Post_AccountMeNotify_Req = { notification_url: string; };
export type Post_AccountMeNotify_Res = SimpleResult<
    {},
    "invalidNotificationUrl" | "accountNotFound" | "internalError"
>;

// GET /account/me/balance
export type Get_AccountMeBalance_Req = {};
export type Get_AccountMeBalance_Res = SimpleResult<
    { balance: number },
    "accountNotFound" | "internalError"
>;

// GET /account/me/frozen
export type Get_AccountMeFrozen_Req = {};
export type Get_AccountMeFrozen_Res = SimpleResult<
    { frozen: boolean },
    "accountNotFound" | "internalError"
>;

// GET /account/me/loans
export type Get_AccountMeLoans_Req = {};
export type Get_AccountMeLoans_Res = SimpleResult<
    { total_due: number; loans: { loan_number: string; due: number }[]; },
    "accountNotFound" | "internalError"
>;

//-------------------- /transaction --------------------//

export type CreateTransactionResult = {
  status: string;
  transaction_number: string;
  transaction_id: number; 
  timestamp: SimTime;
};

export type Transaction = {
  transaction_number: string;
  from: string;
  to: string;
  amount: number;
  description: string;
  status: string;
  timestamp: SimTime;
};

// POST /transaction
export type Post_Transaction_Req = {
  to_account_number: string;
  to_bank_name: BankId,
  amount: number;
  description: string;
};
export type Post_Transaction_Res = SimpleResult<
    { transaction_number: string; status: string },
    "invalidPayload" | "accountNotFound" | "transactionNumberAlreadyExists" | "insufficientFunds" | "accountFrozen" | "internalError"
>;

// GET /transaction
export type Get_Transaction_Req = {
  time_from: number;
  time_to: number;
  only_successful?: boolean;
};
export type Get_Transaction_Res = SimpleResult<
    { transactions: Transaction[] },
    "invalidPayload" | "accountNotFound" | "internalError"
>;

// GET /transaction/{transaction_number}
export type Get_TransactionNumber_Req = {};
export type Get_TransactionNumber_Res = SimpleResult<
    { transaction: Transaction },
    "transactionNotFound" | "internalError"
>;

//-------------------- /loan --------------------//

export type LoanSummary = {
  loan_number: string;
  initial_amount: number;
  interest_rate: number;
  write_off: boolean;
  outstanding_amount: number;
};

export type LoanPayment = {
  timestamp: SimTime;
  amount: number;
  is_interest: boolean;
};

export type LoanDetails = LoanSummary & { payments: LoanPayment[] };

export type LoanResult = {
  loan_number: string;
  initial_transaction_id: number;
  interest_rate: number;
  started_at: string;
  write_off: boolean;
}
export type RepaymentResult = { paid: number; };

// POST /loan
export type Post_Loan_Req = { amount: number; };
export type Post_Loan_Res = Result<
    { loan_number: string },
    { "invalidLoanAmount": {}, "loanNotPermitted": {}, "loanTooLarge": { amount_remaining: number }, "accountNotFound": {}, "internalError": {}, "bankDepleted": {} }
>;

// GET /loan
export type Get_Loan_Req = {};
export type Get_Loan_Res = SimpleResult<
    { total_outstanding_amount: number; loans: LoanSummary[] },
    "accountNotFound" | "internalError"
>;

// POST /loan/{loan_number}/pay
export type Post_LoanNumberPay_Req = { amount: number; };
export type Post_LoanNumberPay_Res = SimpleResult<
    RepaymentResult,
    "invalidPayload" | "invalidRepaymentAmount" | "loanNotFound" | "loanPaidOff" | "loanWrittenOff" | "paymentNotPermitted" | "accountNotFound" | "internalError"
>;

// GET /loan/{loan_number}
export type Get_LoanNumber_Req = {};
export type Get_LoanNumber_Res = SimpleResult<
  { loan: LoanDetails; },
  "loanNotFound" | "internalError"
>;

//-------------------- /interbank --------------------//

// POST /interbank/transfer
export type Post_InterbankTransfer_Req = {
  transaction_number: string;
  from_account_number: string;
  from_bank_name: string;
  to_account_number: string;
  amount: number;
  description: string;
};
export type Post_InterbankTransfer_Res = SimpleResult<
    {},
    "invalidPayload" | "unknownRecipientAccount" | "duplicateTransactionNumber" | "invalidSenderBank" | "invalidAmount" | "transferNotPermitted" | "internalError"
>;