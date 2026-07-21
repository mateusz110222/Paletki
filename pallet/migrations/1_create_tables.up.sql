CREATE TABLE pallets
(
    id                 SERIAL PRIMARY KEY,
    pallet_id          VARCHAR(50)  NOT NULL UNIQUE,
    max_cycles         INT          NOT NULL DEFAULT 1000,
    current_cycles     INT          NOT NULL DEFAULT 0,
    current_unit_cycle INT          NOT NULL DEFAULT 0,
    total_cycles       INT          NOT NULL DEFAULT 0,
    nests              INT          NOT NULL DEFAULT 1,
    status             VARCHAR(50)  NOT NULL DEFAULT 'Active',
    block_reason       TEXT,
    fis                INT                   DEFAULT 0,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by         VARCHAR(100) NOT NULL,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);