---------- Starter data ----------
INSERT INTO transaction_statuses (name) VALUES
  ('success'), 
  ('insufficient_funds'), 
  ('connection_failed')
;

INSERT INTO banks (name, team_id) VALUES
  ('commercial-bank', 'commercial-bank'),
  ('retail-bank', 'retail-bank'),
  ('thoh', 'thoh')