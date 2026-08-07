CREATE TABLE IF NOT EXISTS pallets
(
    id                 SERIAL PRIMARY KEY,
    pallet_id          VARCHAR(50)  NOT NULL UNIQUE,
    project            TEXT,
    model              TEXT,
    max_cycles         INT          NOT NULL DEFAULT 200,
    current_cycles     INT          NOT NULL DEFAULT 0,
    total_cycles       INT          NOT NULL DEFAULT 0,
    nests              INT          NOT NULL DEFAULT 1,
    status             VARCHAR(50)  NOT NULL DEFAULT 'Active',
    block_reason       TEXT,
    fis                INT                   DEFAULT 0,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by         VARCHAR(100) NOT NULL,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by         VARCHAR(100),
    last_operation_description TEXT
);
