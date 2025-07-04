DO $$ 
DECLARE
    i INT;
    j INT;
    acct RECORD;
    new_account_number VARCHAR(12);
    new_transaction_number VARCHAR(32);
    new_loan_number VARCHAR(16);
    from_ref INT;
    to_ref INT;
    txn_id INT;
    loan_id INT;
    status_id INT := 1; -- success
    bank_id INT := 1;
    team_names TEXT[] := ARRAY['team-a', 'team-b', 'team-c', 'team-d', 'team-e'];
BEGIN
    -- === Create 5 accounts with account_refs ===
    FOR i IN 1..5 LOOP
        new_account_number := generate_unique_account_number();
        INSERT INTO accounts (account_number, team_id, notification_url, created_at)
        VALUES (
            new_account_number,
            team_names[i],
            '',
            ROUND(RANDOM() * 1000000) / 1000
        );

        PERFORM get_or_create_account_ref_id(new_account_number, 'commercial-bank');
    END LOOP;

    -- === Create 100 random transactions ===
    FOR i IN 1..100 LOOP
        from_ref := get_or_create_account_ref_id('200000000000', 'commercial-bank');

        SELECT get_or_create_account_ref_id(a.account_number, 'commercial-bank') INTO to_ref
        FROM accounts a
        WHERE a.account_number != '200000000000'
        ORDER BY RANDOM()
        LIMIT 1;

        IF to_ref IS NULL THEN
            CONTINUE;
        END IF;

        new_transaction_number := generate_unique_transaction_number();
        INSERT INTO transactions (
            transaction_number, "from", "to", amount, description, status_id, created_at
        )
        VALUES (
            new_transaction_number,
            from_ref,
            to_ref,
            ROUND((RANDOM() * 10000 + 100)::NUMERIC, 2),
            'Dummy TXN #' || i,
            status_id,
            ROUND(RANDOM() * 1000000) / 1000
        );
    END LOOP;

    -- === Create 10 loans with interest + repayments ===
    FOR i IN 1..10 LOOP
        -- Choose random borrower
        SELECT id, account_number INTO acct
        FROM accounts
        WHERE account_number != '200000000000'
        ORDER BY RANDOM()
        LIMIT 1;

        -- Loan disbursement transaction
        from_ref := get_or_create_account_ref_id('200000000000', 'commercial-bank');
        to_ref := get_or_create_account_ref_id(acct.account_number, 'commercial-bank');

        new_transaction_number := generate_unique_transaction_number();
        INSERT INTO transactions (
            transaction_number, "from", "to", amount, description, status_id, created_at
        )
        VALUES (
            new_transaction_number,
            from_ref,
            to_ref,
            ROUND((RANDOM() * 5000 + 1000)::NUMERIC, 2),
            'Loan Disbursement',
            status_id,
            ROUND(RANDOM() * 1000000) / 1000
        )
        RETURNING id INTO txn_id;

        -- Create loan
        new_loan_number := generate_unique_loan_number();
        INSERT INTO loans (
            loan_number, initial_transaction_id, interest_rate, started_at, write_off
        )
        VALUES (
            new_loan_number,
            txn_id,
            ROUND((0.01 + RANDOM() * 0.15)::NUMERIC, 5),
            ROUND(RANDOM() * 1000000) / 100,
            FALSE
        )
        RETURNING id INTO loan_id;

        -- Create 1–3 loan repayment transactions
        FOR j IN 1..(1 + FLOOR(RANDOM() * 3)) LOOP
            from_ref := get_or_create_account_ref_id(acct.account_number, 'commercial-bank');
            to_ref := get_or_create_account_ref_id('200000000000', 'commercial-bank');
            new_transaction_number := generate_unique_transaction_number();

            INSERT INTO transactions (
                transaction_number, "from", "to", amount, description, status_id, created_at
            )
            VALUES (
                new_transaction_number,
                from_ref,
                to_ref,
                ROUND((RANDOM() * 1000 + 100)::NUMERIC, 2),
                'Loan Repayment #' || j,
                status_id,
                ROUND(RANDOM() * 1000000) / 1000
            )
            RETURNING id INTO txn_id;

            INSERT INTO loan_payments (
                loan_id, transaction_id, is_interest
            )
            VALUES (
                loan_id,
                txn_id,
                (RANDOM() > 0.5)
            );
        END LOOP;
    END LOOP;
END;
$$;