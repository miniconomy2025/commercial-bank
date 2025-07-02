CREATE OR REPLACE FUNCTION gen_4_digits()
RETURNS VARCHAR(4) AS $$
BEGIN RETURN LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION generate_unique_account_number()
RETURNS VARCHAR(12) AS $$
DECLARE new_acc_no VARCHAR(12);
BEGIN
    LOOP
        new_acc_no := '2000' || gen_4_digits() || gen_4_digits();
        EXIT WHEN NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = new_acc_no);
    END LOOP;

    RETURN new_acc_no;
END;
$$ LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION generate_unique_transaction_number()
RETURNS VARCHAR(32) AS $$
DECLARE new_txn_no VARCHAR(32);
BEGIN
  LOOP
    new_txn_no := gen_4_digits() || gen_4_digits() || gen_4_digits() || gen_4_digits();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM transactions WHERE transaction_number = new_txn_no);
  END LOOP;

  RETURN new_txn_no;
END;
$$ LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION generate_unique_loan_number()
RETURNS VARCHAR(16) AS $$
DECLARE new_loan_no VARCHAR(16);
BEGIN
    LOOP
        new_loan_no := gen_4_digits() || gen_4_digits() || gen_4_digits() || gen_4_digits();
        EXIT WHEN NOT EXISTS (SELECT 1 FROM loans WHERE loan_number = new_loan_no);
    END LOOP;

    RETURN new_loan_no;
END;
$$ LANGUAGE plpgsql;