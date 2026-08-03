-- =========================================================================
-- LOGIKA 1: AUTOMATYCZNA BLOKADA CYKLI (BEFORE UPDATE)
-- =========================================================================

CREATE OR REPLACE FUNCTION check_pallet_cycles_and_status()
    RETURNS TRIGGER AS $$
BEGIN
    -- Jeśli cykle osiągnęły limit i paleta jest Active -> blokujemy ją do mycia
    IF NEW.current_cycles >= NEW.max_cycles THEN
        IF NEW.status = 'Active' THEN
            NEW.status := 'Washing_Required';
            NEW.block_reason := 'Automatyczna blokada: Osiągnięto maksymalną liczbę cykli przed myciem (' || NEW.max_cycles || ').';
            -- Skoro blokuje to system/automat bazy danych, oznaczamy to w updated_by:
            NEW.updated_by := 'System_AutoBlock';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS trigger_check_pallet_cycles ON pallets;
CREATE TRIGGER trigger_check_pallet_cycles
    BEFORE UPDATE OF current_cycles, max_cycles, status ON pallets
    FOR EACH ROW
EXECUTE FUNCTION check_pallet_cycles_and_status();


-- =========================================================================
-- LOGIKA 2: AUTOMATYCZNY AUDIT LOG (AFTER INSERT OR UPDATE)
-- =========================================================================

CREATE OR REPLACE FUNCTION audit_pallet_status_change()
    RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO pallet_audit_logs (
            pallet_id, timestamp, operator_id, previous_status, new_status, description
        )
        VALUES (
                   NEW.pallet_id,
                   NOW(),
                   NEW.created_by,
                   'NEW',
                   NEW.status,
                   'Inicjalizacja palety w systemie.'
               );

    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.status IS DISTINCT FROM NEW.status) THEN
            INSERT INTO pallet_audit_logs (
                pallet_id, timestamp, operator_id, previous_status, new_status, description
            )
            VALUES (
                       NEW.pallet_id,
                       NOW(),
                       COALESCE(NEW.updated_by, 'System'),
                       OLD.status,
                       NEW.status,
                       COALESCE(NEW.block_reason, 'Manualna lub zewnętrzna zmiana statusu palety.')
                   );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS trigger_audit_pallet_status ON pallets;
CREATE TRIGGER trigger_audit_pallet_status
    AFTER INSERT OR UPDATE ON pallets
    FOR EACH ROW
EXECUTE FUNCTION audit_pallet_status_change();