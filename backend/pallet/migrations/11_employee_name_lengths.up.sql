DROP VIEW pallet_details;
ALTER TABLE pallets
    ALTER COLUMN created_by TYPE VARCHAR(256),
    ALTER COLUMN updated_by TYPE VARCHAR(256),
    ALTER COLUMN deleted_by TYPE VARCHAR(256);
ALTER TABLE pallet_audit_logs ALTER COLUMN operator_id TYPE VARCHAR(256);
ALTER TABLE operator_reports
    ALTER COLUMN operator_id TYPE VARCHAR(256),
    ALTER COLUMN edited_by TYPE VARCHAR(256);

CREATE VIEW pallet_details AS
SELECT a.id, a.pallet_id, a.project_id, a.model_id, a.max_cycles, a.current_cycles,
       a.total_cycles, a.nests, a.status, a.block_reason, a.fis, a.created_at,
       a.created_by, a.updated_at, a.updated_by, a.last_operation_description,
       a.deleted_at, a.deleted_by, p.name AS project, m.name AS model, a.machine, a.status_changed_at
FROM pallets a JOIN projects p ON p.id = a.project_id
JOIN pallet_models m ON m.id = a.model_id AND m.project_id = a.project_id;
