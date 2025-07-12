-- Utility views, functions, and procs to support API implementation


-- ========== 🔐 1. Authentication helpers ========== --

-- Get local account_id from team ID
CREATE OR REPLACE FUNCTION get_account_id_from_team_id(p_team_id VARCHAR)
RETURNS INT AS $$
DECLARE
    v_account_id INT;
BEGIN
    SELECT id INTO v_account_id FROM accounts WHERE team_id = p_team_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid team ID';
    END IF;
    RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- Get account_number & notification_url from team ID
CREATE OR REPLACE FUNCTION get_account_details_from_team_id(p_team_id VARCHAR)
RETURNS TABLE(account_number VARCHAR, notification_url VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT account_number, notification_url FROM accounts WHERE team_id = p_team_id;
END;
$$ LANGUAGE plpgsql;


-- ========== 🧾 2. Get or Create Account Ref ========== --

-- Gets the ID of an account_ref with certain account_number and bank_name
-- If it does not exist, a new account_ref is created and the new ID returned
-- E.g. $ SELECT * FROM get_or_create_account_ref_id('200012345678', 'commercial-bank');
CREATE OR REPLACE FUNCTION get_or_create_account_ref_id(
    p_account_number VARCHAR,
    p_bank_name VARCHAR
) RETURNS INT AS $$
DECLARE
    v_bank_id INT;
    v_account_ref_id INT;
BEGIN
    -- Find bank
    SELECT id INTO v_bank_id
    FROM banks
    WHERE name = p_bank_name;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bank "%" does not exist.', p_bank_name
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- Check if account_ref exists
    SELECT id INTO v_account_ref_id
    FROM account_refs
    WHERE account_number = p_account_number
      AND bank_id = v_bank_id;

    -- If no account_ref, create new
    IF NOT FOUND THEN
        INSERT INTO account_refs (account_number, bank_id)
        VALUES (p_account_number, v_bank_id)
        RETURNING id INTO v_account_ref_id;
    END IF;


    RETURN v_account_ref_id;
END;
$$ LANGUAGE plpgsql;


-- ========== 💰 3. Balance calculation ========== --

-- Balance of an account_number
CREATE OR REPLACE FUNCTION get_account_balance(p_account_no VARCHAR)
RETURNS NUMERIC AS $$
DECLARE
    v_ref_id INT;
    v_balance NUMERIC := 0;
    v_dummy INT;
BEGIN
    -- Check if the account exists
    SELECT 1 INTO v_dummy
    FROM accounts
    WHERE account_number = p_account_no;

    IF NOT FOUND THEN RETURN NULL;
    END IF;

    -- Get or create the account_ref_id for this local account
    v_ref_id := get_or_create_account_ref_id(p_account_no, 'commercial-bank');

    -- Calculate net balance: inbound - outbound
    SELECT
        COALESCE(SUM(CASE WHEN t."to"   = v_ref_id THEN t.amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t."from" = v_ref_id THEN t.amount ELSE 0 END), 0)
    INTO v_balance
    FROM transactions t
    JOIN transaction_statuses s ON s.id = t.status_id
    WHERE s.name = 'success';

    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;



-- ========== ❄️ 4. Frozen state check ========== --

CREATE OR REPLACE FUNCTION is_account_frozen(p_account_no VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_balance NUMERIC;
    v_interest_due NUMERIC;
BEGIN
    v_balance := get_account_balance(p_account_no);

    SELECT COALESCE(SUM(t.amount), 0)
    INTO v_interest_due
    FROM accounts a
    JOIN account_refs ar ON ar.account_number = a.account_number AND ar.bank_id = 1
    JOIN transactions t ON t.from = ar.id
    JOIN loan_payments lp ON lp.transaction_id = t.id
    JOIN loans l ON l.id = lp.loan_id
    WHERE a.account_number = p_account_no AND lp.is_interest = TRUE AND l.write_off = FALSE;

    IF v_interest_due > v_balance THEN
        RETURN TRUE;
    END IF;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;


-- ========== 💳 5. Loan outstanding view ========== --

CREATE OR REPLACE VIEW loan_status AS
SELECT
    l.id,
    l.loan_number,
    l.initial_transaction_id,
    l.interest_rate,
    l.started_at,
    l.write_off,
    tr.to AS account_ref_id,
    tr.amount AS initial_amount,
    (
        SELECT COALESCE(SUM(t2.amount), 0)
        FROM transactions t2
        JOIN loan_payments lp2 ON lp2.transaction_id = t2.id
        WHERE lp2.loan_id = l.id AND lp2.is_interest = FALSE
    ) AS total_repaid
FROM loans l
JOIN transactions tr ON tr.id = l.initial_transaction_id
JOIN transaction_statuses s ON tr.status_id = s.id AND s.name = 'success';


-- ========== 📄 6. Account Statement View ========== --

CREATE OR REPLACE VIEW account_statement AS
SELECT
    t.transaction_number,
    CASE WHEN ar_to.bank_id = 1 AND ar_to.account_number = a.account_number THEN 'incoming'
         ELSE 'outgoing' END AS type,
    t.amount,
    t.description,
    s.name AS status,
    t.created_at AS timestamp,
    a.team_id
FROM transactions t
JOIN transaction_statuses s ON s.id = t.status_id
JOIN account_refs ar_from ON ar_from.id = t.from
JOIN account_refs ar_to ON ar_to.id = t.to
JOIN accounts a ON a.account_number IN (ar_from.account_number, ar_to.account_number) AND a.team_id IS NOT NULL
WHERE a.account_number IN (ar_from.account_number, ar_to.account_number);


-- ========== 📌 7. Loan Payment Summary ========== --

CREATE OR REPLACE VIEW loan_payment_summary AS
SELECT
    l.loan_number,
    lp.is_interest,
    t.amount,
    t.created_at AS timestamp
FROM loan_payments lp
JOIN loans l ON lp.loan_id = l.id
JOIN transactions t ON lp.transaction_id = t.id;