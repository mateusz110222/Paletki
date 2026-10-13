ALTER TABLE pallets ADD COLUMN status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE pallets p SET status_changed_at = COALESCE((
    SELECT timestamp FROM pallet_audit_logs WHERE pallet_id=p.pallet_id
    AND new_status=p.status AND previous_status<>new_status ORDER BY id DESC LIMIT 1
), p.created_at);
CREATE INDEX pallets_status_entry_date ON pallets(status_changed_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW pallet_details AS
SELECT a.id, a.pallet_id, a.project_id, a.model_id, a.max_cycles, a.current_cycles,
       a.total_cycles, a.nests, a.status, a.block_reason, a.fis, a.created_at,
       a.created_by, a.updated_at, a.updated_by, a.last_operation_description,
       a.deleted_at, a.deleted_by, p.name AS project, m.name AS model, a.machine, a.status_changed_at
FROM pallets a JOIN projects p ON p.id = a.project_id
JOIN pallet_models m ON m.id = a.model_id AND m.project_id = a.project_id;

CREATE TABLE pallet_service_periods (
    id SERIAL PRIMARY KEY, pallet_id VARCHAR(50) NOT NULL REFERENCES pallets(pallet_id),
    service_status VARCHAR(50) NOT NULL CHECK (service_status IN ('Damaged','Washing_Required')),
    started_at TIMESTAMPTZ NOT NULL, finished_at TIMESTAMPTZ,
    completed BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX pallet_service_periods_finished ON pallet_service_periods(finished_at) WHERE completed;
CREATE UNIQUE INDEX pallet_service_periods_open ON pallet_service_periods(pallet_id) WHERE finished_at IS NULL;
-- Preserve existing turnaround statistics before automatic transitions leave the audit.
INSERT INTO pallet_service_periods(pallet_id,service_status,started_at,finished_at,completed)
SELECT started.pallet_id,started.new_status,started.timestamp,finished.timestamp,COALESCE(finished.new_status='Active',false)
FROM pallet_audit_logs started
LEFT JOIN LATERAL (
    SELECT timestamp,new_status FROM pallet_audit_logs
    WHERE pallet_id=started.pallet_id AND id>started.id AND previous_status<>new_status ORDER BY id LIMIT 1
) finished ON true
WHERE started.new_status IN ('Damaged','Washing_Required') AND started.previous_status<>started.new_status;
INSERT INTO pallet_service_periods(pallet_id,service_status,started_at)
SELECT p.pallet_id,p.status,p.status_changed_at FROM pallets p
WHERE p.deleted_at IS NULL AND p.status IN ('Damaged','Washing_Required')
AND NOT EXISTS(SELECT 1 FROM pallet_service_periods sp WHERE sp.pallet_id=p.pallet_id AND sp.finished_at IS NULL);

CREATE FUNCTION track_pallet_status_entry() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status OR (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
        NEW.status_changed_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Alphabetical order ensures this sees the final status after the cycle rule.
CREATE TRIGGER trigger_track_status_entry BEFORE UPDATE ON pallets
FOR EACH ROW EXECUTE FUNCTION track_pallet_status_entry();
CREATE FUNCTION track_pallet_service_period() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP='UPDATE' THEN
        IF OLD.status IS NOT DISTINCT FROM NEW.status AND OLD.deleted_at IS NOT DISTINCT FROM NEW.deleted_at THEN RETURN NEW; END IF;
        UPDATE pallet_service_periods SET finished_at=NOW(),completed=(NEW.status='Active' AND NEW.deleted_at IS NULL AND OLD.status IN ('Damaged','Washing_Required'))
        WHERE pallet_id=NEW.pallet_id AND finished_at IS NULL;
    END IF;
    IF NEW.deleted_at IS NULL AND NEW.status IN ('Damaged','Washing_Required') THEN
        INSERT INTO pallet_service_periods(pallet_id,service_status,started_at) VALUES(NEW.pallet_id,NEW.status,NEW.status_changed_at);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_track_service_period AFTER INSERT OR UPDATE ON pallets
FOR EACH ROW EXECUTE FUNCTION track_pallet_service_period();

-- Correct the earlier combined release wording without changing its comment, author or time.
UPDATE pallet_audit_logs SET description='i18n:' || jsonb_set(substring(description from 6)::jsonb,'{key}','"audit_unblocked"')::text
WHERE description LIKE 'i18n:%' AND position('"audit_unblocked_cycle_limit"' in description)>0;

CREATE OR REPLACE FUNCTION check_pallet_cycles_and_status() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_cycles >= NEW.max_cycles AND NEW.status = 'Active' THEN
        NEW.status := 'Washing_Required';
        -- Release remains a release event; cycle routing has no separate audit entry.
        IF OLD.status <> 'Blocked' AND OLD.max_cycles IS NOT DISTINCT FROM NEW.max_cycles
           AND OLD.machine IS NOT DISTINCT FROM NEW.machine
           AND OLD.fis IS NOT DISTINCT FROM NEW.fis
           AND OLD.nests IS NOT DISTINCT FROM NEW.nests THEN
            NEW.last_operation_description := 'i18n:' || jsonb_build_object(
                'key', 'audit_cycle_limit', 'variables', jsonb_build_object('maxCycles', NEW.max_cycles)
            )::text;
            NEW.updated_by := 'System_AutoBlock';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION audit_pallet_status_change()
    RETURNS TRIGGER AS
$$
BEGIN
    IF TG_OP = 'UPDATE' AND current_setting('palletx.report_edit', true) = 'on' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.status = 'Washing_Required'
       AND NEW.updated_by = 'System_AutoBlock'
       AND position('"audit_cycle_limit"' in COALESCE(NEW.last_operation_description, '')) > 0 THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
        INSERT INTO pallet_audit_logs (
            pallet_id, timestamp, operator_id, previous_status, new_status, description
        ) VALUES (
            NEW.pallet_id,
            NOW(),
            NEW.created_by,
            'NEW',
            NEW.status,
            COALESCE(NEW.last_operation_description, 'i18n:{"key":"audit_registered"}')
        );
    ELSIF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        INSERT INTO pallet_audit_logs (
            pallet_id, timestamp, operator_id, previous_status, new_status, description
        ) VALUES (
            NEW.pallet_id,
            NOW(),
            COALESCE(NEW.deleted_by, NEW.updated_by, 'System'),
            OLD.status,
            'DELETED',
            COALESCE(NEW.last_operation_description, 'i18n:{"key":"audit_deleted"}')
        );
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        INSERT INTO pallet_audit_logs (
            pallet_id, timestamp, operator_id, previous_status, new_status, description
        ) VALUES (
            NEW.pallet_id,
            NOW(),
            COALESCE(NEW.created_by, NEW.updated_by, 'System'),
            'DELETED',
            NEW.status,
            COALESCE(NEW.last_operation_description, 'i18n:{"key":"audit_registered"}')
        );
    ELSIF TG_OP = 'UPDATE' AND (
        OLD.project_id IS DISTINCT FROM NEW.project_id OR
        OLD.model_id IS DISTINCT FROM NEW.model_id OR
        OLD.max_cycles IS DISTINCT FROM NEW.max_cycles OR
        OLD.nests IS DISTINCT FROM NEW.nests OR
        OLD.status IS DISTINCT FROM NEW.status OR
        OLD.block_reason IS DISTINCT FROM NEW.block_reason OR
        OLD.fis IS DISTINCT FROM NEW.fis OR
        OLD.machine IS DISTINCT FROM NEW.machine
    ) THEN
        INSERT INTO pallet_audit_logs (
            pallet_id, timestamp, operator_id, previous_status, new_status, description
        ) VALUES (
            NEW.pallet_id,
            NOW(),
            COALESCE(NEW.updated_by, 'System'),
            OLD.status,
            NEW.status,
            COALESCE(
                NEW.last_operation_description,
                NEW.block_reason,
                'i18n:{"key":"audit_edited"}'
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
