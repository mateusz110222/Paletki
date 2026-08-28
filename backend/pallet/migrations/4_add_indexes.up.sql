CREATE INDEX IF NOT EXISTS idx_pallets_project_status ON pallets (project, status);
CREATE INDEX IF NOT EXISTS idx_pallets_status ON pallets (status);
CREATE INDEX IF NOT EXISTS idx_pallets_created_by ON pallets (created_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name_unique_ci
    ON projects (LOWER(TRIM(name)));

CREATE INDEX IF NOT EXISTS idx_pallets_maintenance_required
    ON pallets (pallet_id, status)
    WHERE status IN ('Washing_Required', 'Damaged', 'Blocked');

CREATE INDEX IF NOT EXISTS idx_pallets_cycles ON pallets (current_cycles DESC, max_cycles);
CREATE INDEX IF NOT EXISTS idx_pallets_active_id
    ON pallets (id)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_pallet_timestamp ON pallet_audit_logs (pallet_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON pallet_audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operator ON pallet_audit_logs (operator_id);

CREATE INDEX IF NOT EXISTS idx_pallets_project_model
    ON pallets (project, model)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pallets_upper_pallet_id
    ON pallets (UPPER(pallet_id))
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pallets_upper_model
    ON pallets (UPPER(model))
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pallets_upper_created_by
    ON pallets (UPPER(created_by))
    WHERE deleted_at IS NULL;
