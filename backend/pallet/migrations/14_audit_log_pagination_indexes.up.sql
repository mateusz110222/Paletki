CREATE INDEX IF NOT EXISTS idx_audit_logs_pallet_id_desc ON pallet_audit_logs (pallet_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp_id_desc ON pallet_audit_logs (timestamp DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_status_ts_id ON pallet_audit_logs (new_status, timestamp DESC, id DESC);
DROP INDEX IF EXISTS idx_audit_logs_timestamp;

CREATE INDEX IF NOT EXISTS idx_fis_outbox_processing_locked ON fis_outbox (locked_at) WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_operator_reports_defect_id ON operator_reports (defect_id) WHERE defect_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_periods_completed_covering
    ON pallet_service_periods (finished_at DESC) INCLUDE (pallet_id, started_at)
    WHERE completed;
DROP INDEX IF EXISTS pallet_service_periods_finished;

ALTER TABLE pallets
    ADD CONSTRAINT pallets_cycles_nonnegative CHECK (current_cycles >= 0 AND total_cycles >= 0);
