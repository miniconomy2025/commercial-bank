DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'loans'
    ) THEN
        DROP VIEW IF EXISTS loan_status;
        DROP VIEW IF EXISTS account_statement;
        DROP VIEW IF EXISTS loan_payment_summary;
        
        ALTER TABLE loans 
        ALTER COLUMN started_at TYPE NUMERIC(15, 2);
		ALTER TABLE transactions 
        ALTER COLUMN created_at TYPE NUMERIC(15, 2);
        
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
		
		-- ========== 📄 5. Account Statement View ========== --
		
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
		
		
		-- ========== 📌 6. Loan Payment Summary ========== --
		
		CREATE OR REPLACE VIEW loan_payment_summary AS
		SELECT
		    l.loan_number,
		    lp.is_interest,
		    t.amount,
		    t.created_at AS timestamp
		FROM loan_payments lp
		JOIN loans l ON lp.loan_id = l.id
		JOIN transactions t ON lp.transaction_id = t.id;
        RAISE NOTICE 'Views recreated successfully';
        
    ELSE
        RAISE NOTICE 'Table loans does not exist';
    END IF;
END $$;