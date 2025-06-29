-- Utility views, functions, and procs to support API implementation

-- =========================
-- 🔐 1. Authentication helpers
-- =========================

-- Get local account_id from API key
CREATE OR REPLACE FUNCTION get_account_id_from_api_key(p_api_key VARCHAR)
RETURNS INT AS $$
DECLARE
    v_account_id INT;
BEGIN
    SELECT id INTO v_account_id FROM accounts WHERE api_key = p_api_key;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid API key';
    END IF;
    RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- Get account_number & callback_url from API key
CREATE OR REPLACE FUNCTION get_account_details_from_api_key(p_api_key VARCHAR)
RETURNS TABLE(account_number VARCHAR, callback_url VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT account_number, callback_url FROM accounts WHERE api_key = p_api_key;
END;
$$ LANGUAGE plpgsql;

-- =========================
-- 💰 2. Balance calculation
-- =========================

-- Balance of an account_id
CREATE OR REPLACE FUNCTION get_account_balance(p_account_id INT)
RETURNS NUMERIC AS $$
DECLARE
    v_account_number VARCHAR(12);
    v_bank_id INT := 1; -- local bank
    v_ref_id INT;
    v_balance NUMERIC := 0;
BEGIN
    SELECT account_number INTO v_account_number FROM accounts WHERE id = p_account_id;
    SELECT id INTO v_ref_id FROM account_refs 
    WHERE account_number = v_account_number AND bank_id = v_bank_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    SELECT
        COALESCE(SUM(CASE WHEN "to" = v_ref_id THEN amount ELSE 0 END), 0)
    INTO v_balance
    FROM transactions t
    JOIN transaction_statuses s ON s.id = t.status_id
    WHERE s.name = 'success';

    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- =========================
-- ❄️ 3. Frozen state check
-- =========================

CREATE OR REPLACE FUNCTION is_account_frozen(p_account_id INT)
RETURNS BOOLEAN AS $$
DECLARE
    v_balance NUMERIC;
    v_interest_due NUMERIC;
BEGIN
    v_balance := get_account_balance(p_account_id);

    SELECT COALESCE(SUM(t.amount), 0)
    INTO v_interest_due
    FROM accounts a
    JOIN account_refs ar ON ar.account_number = a.account_number AND ar.bank_id = 1
    JOIN transactions t ON t.from = ar.id
    JOIN loan_payments lp ON lp.transaction_id = t.id
    JOIN loans l ON l.id = lp.loan_id
    WHERE a.id = p_account_id AND lp.is_interest = TRUE AND l.write_off = FALSE;

    IF v_interest_due > v_balance THEN
        RETURN TRUE;
    END IF;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- =========================
-- 💳 4. Loan outstanding view
-- =========================

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

-- =========================
-- 📄 5. Account Statement View
-- =========================

CREATE OR REPLACE VIEW account_statement AS
SELECT
    t.transaction_number,
    CASE WHEN ar_to.bank_id = 1 AND ar_to.account_number = a.account_number THEN 'incoming'
         ELSE 'outgoing' END AS type,
    t.amount,
    t.description,
    s.name AS status,
    t.created_at AS timestamp,
    a.api_key
FROM transactions t
JOIN transaction_statuses s ON s.id = t.status_id
JOIN account_refs ar_from ON ar_from.id = t.from
JOIN account_refs ar_to ON ar_to.id = t.to
JOIN accounts a ON a.account_number IN (ar_from.account_number, ar_to.account_number) AND a.api_key IS NOT NULL
WHERE a.account_number IN (ar_from.account_number, ar_to.account_number);

-- =========================
-- 📌 6. Loan Payment Summary
-- =========================

CREATE OR REPLACE VIEW loan_payment_summary AS
SELECT
    l.loan_number,
    lp.is_interest,
    t.amount,
    t.created_at AS timestamp
FROM loan_payments lp
JOIN loans l ON lp.loan_id = l.id
JOIN transactions t ON lp.transaction_id = t.id;