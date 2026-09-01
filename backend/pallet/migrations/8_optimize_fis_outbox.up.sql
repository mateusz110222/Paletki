CREATE INDEX IF NOT EXISTS idx_fis_outbox_completed_processed_at
    ON fis_outbox (processed_at, id)
    WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_fis_outbox_active_pallet_order
    ON fis_outbox (pallet_id, id)
    WHERE status IN ('pending', 'processing');
