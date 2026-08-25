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
    fis                INT          NOT NULL DEFAULT 1,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by         VARCHAR(100) NOT NULL,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by         VARCHAR(100),
    last_operation_description TEXT,
    CONSTRAINT pallets_status_supported
        CHECK (status IN ('Active', 'Washing_Required', 'Damaged', 'Blocked')),
    CONSTRAINT pallets_positive_values
        CHECK (max_cycles > 0 AND nests > 0 AND fis IN (1, 2))
);

CREATE TABLE IF NOT EXISTS auth_sessions
(
    token_hash  VARCHAR(64)  PRIMARY KEY,
    username    VARCHAR(256) NOT NULL,
    full_name   VARCHAR(256) NOT NULL,
    department  TEXT         NOT NULL DEFAULT '',
    title       TEXT         NOT NULL DEFAULT '',
    role        VARCHAR(20)  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ  NOT NULL,
    CONSTRAINT auth_sessions_role_supported
        CHECK (role IN ('staff', 'operator'))
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
    ON auth_sessions (expires_at);
