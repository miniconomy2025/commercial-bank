---------- Starter data ----------
INSERT INTO transaction_statuses (name) VALUES
  ('success'), 
  ('insufficientFunds'), 
  ('connectionFailed'),
  ('internalError')
;

INSERT INTO banks (name, team_id) VALUES
  ('commercial-bank', 'commercial-bank'),
  ('retail-bank', 'retail-bank'),
  ('thoh', 'thoh')