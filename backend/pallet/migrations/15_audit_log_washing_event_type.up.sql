-- Tag washing confirmations structurally so the "Washed" report filter includes
-- early/preventive washes (Active -> Active) without scanning audit descriptions
-- or distorting status history and service duration statistics.
ALTER TABLE pallet_audit_logs
    ADD COLUMN IF NOT EXISTS event_type TEXT;

UPDATE pallet_audit_logs
SET event_type = 'washing_confirmed'
WHERE event_type IS NULL
  AND description LIKE 'i18n:{"key":"audit_washing_confirmed"%';

CREATE INDEX IF NOT EXISTS idx_pallet_audit_logs_washed_timeline
    ON pallet_audit_logs (timestamp DESC, id DESC)
    WHERE (previous_status = 'Washing_Required' AND new_status = 'Active')
       OR event_type = 'washing_confirmed';
