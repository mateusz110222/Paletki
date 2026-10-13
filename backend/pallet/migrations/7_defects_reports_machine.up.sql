ALTER TABLE pallets ADD COLUMN machine VARCHAR(4) NOT NULL DEFAULT 'WSM' CHECK (machine IN ('WSM', 'SSM', 'COAT'));
CREATE OR REPLACE VIEW pallet_details AS
SELECT a.id, a.pallet_id, a.project_id, a.model_id, a.max_cycles, a.current_cycles,
       a.total_cycles, a.nests, a.status, a.block_reason, a.fis, a.created_at,
       a.created_by, a.updated_at, a.updated_by, a.last_operation_description,
       a.deleted_at, a.deleted_by, p.name AS project, m.name AS model, a.machine
FROM pallets a JOIN projects p ON p.id = a.project_id
JOIN pallet_models m ON m.id = a.model_id AND m.project_id = a.project_id;

CREATE TABLE defects (
    id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL CHECK (length(trim(name)) > 0)
);
CREATE UNIQUE INDEX defects_unique_name ON defects (lower(trim(name)));
CREATE TABLE operator_reports (
    id SERIAL PRIMARY KEY, pallet_id VARCHAR(50) NOT NULL REFERENCES pallets(pallet_id),
    audit_log_id INT NOT NULL UNIQUE REFERENCES pallet_audit_logs(id),
    defect_id INT REFERENCES defects(id) ON DELETE SET NULL,
    kind VARCHAR(16) NOT NULL DEFAULT 'defect' CHECK (kind IN ('defect', 'washing')),
    defect_name VARCHAR(100) NOT NULL, description TEXT NOT NULL DEFAULT '',
    operator_id VARCHAR(100) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ, version INT NOT NULL DEFAULT 1,
    edited_by VARCHAR(100), edited_at TIMESTAMPTZ
);
CREATE INDEX operator_reports_open ON operator_reports(pallet_id, id) WHERE closed_at IS NULL;

CREATE OR REPLACE FUNCTION audit_pallet_status_change()
    RETURNS TRIGGER AS
$$
BEGIN
    IF TG_OP = 'UPDATE' AND current_setting('palletx.report_edit', true) = 'on' THEN
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


CREATE FUNCTION close_operator_reports() RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'Active' AND OLD.status IS DISTINCT FROM NEW.status)
       OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
        UPDATE operator_reports SET closed_at = NOW(), version = version + 1
        WHERE pallet_id = NEW.pallet_id AND closed_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_close_operator_reports AFTER UPDATE ON pallets
FOR EACH ROW EXECUTE FUNCTION close_operator_reports();

-- Keep the required release comment even when the cycle rule immediately requests washing.
CREATE OR REPLACE FUNCTION check_pallet_cycles_and_status()
    RETURNS TRIGGER AS
$$
BEGIN
    IF NEW.current_cycles >= NEW.max_cycles AND NEW.status = 'Active' THEN
        NEW.status := 'Washing_Required';
        IF OLD.status = 'Blocked' AND NEW.last_operation_description LIKE 'i18n:%' THEN
            NEW.last_operation_description := 'i18n:' || jsonb_build_object(
                'key', 'audit_unblocked_cycle_limit',
                'variables', jsonb_build_object('maxCycles', NEW.max_cycles),
                'comment', (substring(NEW.last_operation_description from 6)::jsonb)->>'comment'
            )::TEXT;
        ELSE
        NEW.last_operation_description := 'i18n:' || jsonb_build_object(
            'key', 'audit_cycle_limit',
            'variables', jsonb_build_object('maxCycles', NEW.max_cycles)
        )::TEXT;
        NEW.updated_by := 'System_AutoBlock';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
