-- Generic function to prevent delete
CREATE OR REPLACE FUNCTION prevent_delete()
RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Deletion is not allowed on this table.'; END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'banks', 'accounts', 'account_refs', 'transaction_statuses',
        'transactions', 'loans', 'loan_payments'
    ])
    LOOP
        EXECUTE format($f$
            CREATE TRIGGER trg_prevent_delete_%1$s
            BEFORE DELETE ON %1$I
            FOR EACH ROW EXECUTE FUNCTION prevent_delete();
        $f$, tbl);
    END LOOP;
END $$;
