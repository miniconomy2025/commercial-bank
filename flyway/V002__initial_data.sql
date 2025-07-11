---------- Starter data ----------
INSERT INTO transaction_statuses (name) VALUES
  ('success'), 
  ('insufficientFunds'), 
  ('connectionFailed'),
  ('internalError'),
;

INSERT INTO banks (name, team_id) VALUES
  ('commercial-bank', 'commercial-bank'),
  ('retail-bank', 'retail-bank'),
  ('thoh', 'thoh')
;

-- Add commercial-bank account & account_ref
INSERT INTO accounts (account_number, team_id, notification_url, created_at) VALUES ('200000000000', 'commercial-bank', '', 0);
INSERT INTO account_refs (account_number, bank_id) VALUES ('200000000000', 1);



SELECT * FROM transactions;