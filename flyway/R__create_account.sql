CREATE OR REPLACE FUNCTION create_account(
    created_at NUMERIC(9, 3),
    notification_url VARCHAR(255),
    team_id VARCHAR(32),
    OUT account_number VARCHAR(12)
) 
LANGUAGE plpgsql
AS $$
BEGIN
    DECLARE
        bank_id INTEGER := (SELECT id FROM banks WHERE banks.name = 'commercial-bank');
        generated_account_number VARCHAR(12);
    
    BEGIN
        IF EXISTS (SELECT 1 FROM accounts WHERE accounts.team_id = create_account.team_id) THEN
            account_number := 'accountAlreadyExists';
            RETURN;
        END IF;
        
        generated_account_number := generate_unique_account_number();
        
        INSERT INTO accounts (account_number, team_id, notification_url, created_at)
        VALUES (generated_account_number, create_account.team_id, create_account.notification_url, create_account.created_at);
        
        INSERT INTO account_refs (account_number, bank_id)
        VALUES (generated_account_number, bank_id);
        
        account_number := generated_account_number;
    END;
END;
$$;