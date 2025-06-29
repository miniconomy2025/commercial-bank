---------- Table creation ----------
CREATE TABLE banks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE
);

CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    account_number VARCHAR(12) NOT NULL UNIQUE,
    api_key VARCHAR(256) NOT NULL,
    notification_url VARCHAR(256) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    closed_at TIMESTAMP
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
    "from" INT NOT NULL REFERENCES account_refs(id),
    "to" INT NOT NULL REFERENCES account_refs(id),
    amount NUMERIC(15,2) NOT NULL,
    description VARCHAR(128) NOT NULL,
    status_id INT NOT NULL REFERENCES transaction_statuses(id),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE loans (
    id SERIAL PRIMARY KEY,
    loan_number VARCHAR(16) NOT NULL UNIQUE,
    initial_transaction_id INT NOT NULL REFERENCES transactions(id),
    interest_rate NUMERIC(8,5) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    write_off BOOLEAN NOT NULL
);

CREATE TABLE loan_payments (
    id SERIAL PRIMARY KEY,
    loan_id INT NOT NULL REFERENCES loans(id),
    transaction_id INT NOT NULL UNIQUE REFERENCES transactions(id),
    is_interest BOOLEAN NOT NULL
);