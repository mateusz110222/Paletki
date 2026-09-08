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
