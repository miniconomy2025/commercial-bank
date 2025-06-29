---------- Starter data ----------
MERGE INTO transaction_statuses AS target
USING (VALUES 
    ('success'), 
    ('insufficient_funds'), 
    ('connection_failed')
) AS source(name)
ON target.name = source.name
WHEN NOT MATCHED THEN
  INSERT (name) VALUES (source.name);

MERGE INTO banks AS target
USING (VALUES 
    ('Apex Commercial Bank')
) AS source(name)
ON target.name = source.name
WHEN NOT MATCHED THEN
  INSERT (name) VALUES (source.name);
