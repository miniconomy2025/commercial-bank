CREATE OR REPLACE FUNCTION generate_unique_account_number()
RETURNS VARCHAR(12) AS $$
DECLARE
    new_account_number VARCHAR(12);
BEGIN
    LOOP
        new_account_number := LPAD(FLOOR(RANDOM() * 9000000000 + 1000000000)::TEXT, 12, '0');

        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM accounts WHERE account_number = new_account_number
        );
    END LOOP;

    RETURN new_account_number;
END;
$$ LANGUAGE plpgsql;