CREATE OR REPLACE PROCEDURE your_procedure_name(
    bank_name VARCHAR(255),
    created_at TIMESTAMP,
    notification_url VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_inserted_id INTEGER;
BEGIN
    START TRANSACTION;
    
    BEGIN

        DECLARE bank_id INTEGER := (SELECT id FROM banks WHERE [name] = bank_name);
        INSERT INTO accounts (
            column1, column2,
            column3, created_at
        ) VALUES (
            p_param1,
            p_param2,
            p_param3,
            NOW()
        ) RETURNING id INTO v_inserted_id;
        
        COMMIT;
        
        RAISE NOTICE 'Successfully inserted record with ID: %', v_inserted_id;
        
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            RAISE EXCEPTION 'Failed to insert record: %', SQLERRM;
    END;
END;
$$;