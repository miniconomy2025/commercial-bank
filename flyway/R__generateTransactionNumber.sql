CREATE OR REPLACE FUNCTION generate_unique_transaction_number()
RETURNS VARCHAR(12) AS $$
DECLARE
  new_txn VARCHAR(12);
BEGIN
  LOOP
    new_txn := LPAD(FLOOR(RANDOM() * 900000000000 + 100000000000)::TEXT, 12, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM transactions WHERE transaction_number = new_txn
    );
  END LOOP;

  RETURN new_txn;
END;
$$ LANGUAGE plpgsql;
