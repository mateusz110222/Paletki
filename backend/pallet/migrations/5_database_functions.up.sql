-- Automatically move a pallet to washing when it reaches its cycle limit.
CREATE OR REPLACE FUNCTION check_pallet_cycles_and_status()
    RETURNS TRIGGER AS
$$
BEGIN
    IF NEW.current_cycles >= NEW.max_cycles AND NEW.status = 'Active' THEN
        NEW.status := 'Washing_Required';
        NEW.last_operation_description := 'i18n:' || jsonb_build_object(
            'key', 'audit_cycle_limit',
            'variables', jsonb_build_object('maxCycles', NEW.max_cycles)
        )::TEXT;
        NEW.updated_by := 'System_AutoBlock';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_pallet_cycles
    BEFORE UPDATE OF current_cycles, max_cycles, status
    ON pallets
    FOR EACH ROW
EXECUTE FUNCTION check_pallet_cycles_and_status();

-- Audit creation and meaningful pallet changes. Counter-only soldering cycle
-- updates are intentionally omitted to keep the history readable.
CREATE OR REPLACE FUNCTION audit_pallet_status_change()
    RETURNS TRIGGER AS
$$
BEGIN
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
    ELSIF TG_OP = 'UPDATE' AND (
        OLD.project IS DISTINCT FROM NEW.project OR
        OLD.model IS DISTINCT FROM NEW.model OR
        OLD.max_cycles IS DISTINCT FROM NEW.max_cycles OR
        OLD.nests IS DISTINCT FROM NEW.nests OR
        OLD.status IS DISTINCT FROM NEW.status OR
        OLD.block_reason IS DISTINCT FROM NEW.block_reason OR
        OLD.fis IS DISTINCT FROM NEW.fis
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

CREATE TRIGGER trigger_audit_pallet_status
    AFTER INSERT OR UPDATE
    ON pallets
    FOR EACH ROW
EXECUTE FUNCTION audit_pallet_status_change();
