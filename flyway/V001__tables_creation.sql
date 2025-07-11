CREATE TABLE banks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,
    team_id VARCHAR(32) NOT NULL UNIQUE
);

CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    account_number VARCHAR(12) NOT NULL UNIQUE,
    team_id VARCHAR(32) NOT NULL UNIQUE,
    notification_url VARCHAR(256) NOT NULL,
    created_at NUMERIC(60, 3) NOT NULL,
    closed_at NUMERIC(60, 3)
);

CREATE TABLE account_refs (
    id SERIAL PRIMARY KEY,
    account_number VARCHAR(12) NOT NULL,
    bank_id INT NOT NULL REFERENCES banks(id),
    CONSTRAINT unq_account_ref UNIQUE (account_number, bank_id)
);

CREATE TABLE transaction_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE
);

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    transaction_number VARCHAR(32) NOT NULL UNIQUE,
    "from" INT NOT NULL REFERENCES account_refs(id) ON DELETE CASCADE,
    "to" INT NOT NULL REFERENCES account_refs(id) ON DELETE CASCADE,
    amount NUMERIC(15,2) NOT NULL,
    description VARCHAR(128) NOT NULL,
    status_id INT NOT NULL REFERENCES transaction_statuses(id),
    created_at NUMERIC(60, 3) NOT NULL
);

CREATE TABLE loans (
    id SERIAL PRIMARY KEY,
    loan_number VARCHAR(16) NOT NULL UNIQUE,
    initial_transaction_id INT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    interest_rate NUMERIC(8,5) NOT NULL,
    started_at NUMERIC(60, 3) NOT NULL,
    write_off BOOLEAN NOT NULL
);

CREATE TABLE loan_payments (
    id SERIAL PRIMARY KEY,
    loan_id INT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    transaction_id INT NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
    is_interest BOOLEAN NOT NULL
);