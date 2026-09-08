CREATE TABLE IF NOT EXISTS fis_outbox
(
    id              BIGSERIAL PRIMARY KEY,
    idempotency_key UUID        NOT NULL UNIQUE,
    pallet_id       VARCHAR(50) NOT NULL,
    operation       VARCHAR(16) NOT NULL,
    payload         JSONB       NOT NULL,
    status          VARCHAR(16) NOT NULL DEFAULT 'pending',
    attempts        INT         NOT NULL DEFAULT 0,
    available_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at       TIMESTAMPTZ,
    last_error      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ,
    CONSTRAINT fis_outbox_operation_supported
        CHECK (operation IN ('SYNC', 'MIGRATE', 'DELETE')),
    CONSTRAINT fis_outbox_status_supported
        CHECK (status IN ('pending', 'processing', 'completed', 'dead')),
    CONSTRAINT fis_outbox_attempts_nonnegative CHECK (attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_fis_outbox_pending
    ON fis_outbox (available_at, id)
    WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS fis_reconciliation_state
(
    singleton      BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    last_pallet_id INT         NOT NULL DEFAULT 0,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO fis_reconciliation_state (singleton)
VALUES (TRUE)
ON CONFLICT (singleton) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_fis_outbox_completed_processed_at
    ON fis_outbox (processed_at, id)
    WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_fis_outbox_active_pallet_order
    ON fis_outbox (pallet_id, id)
    WHERE status IN ('pending', 'processing');
