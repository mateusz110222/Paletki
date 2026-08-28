CREATE TABLE IF NOT EXISTS pallet_audit_logs
(
    id              SERIAL PRIMARY KEY,
    pallet_id       VARCHAR(50)  NOT NULL REFERENCES pallets (pallet_id) ON DELETE RESTRICT,
    timestamp       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    operator_id     VARCHAR(100) NOT NULL,
    previous_status VARCHAR(50)  NOT NULL,
    new_status      VARCHAR(50)  NOT NULL,
    description     TEXT         NOT NULL
);
