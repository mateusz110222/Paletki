CREATE INDEX IF NOT EXISTS idx_pallets_project_status ON pallets (project, status);
CREATE INDEX IF NOT EXISTS idx_pallets_status ON pallets (status);
CREATE INDEX IF NOT EXISTS idx_pallets_created_by ON pallets (created_by);



CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_project_unique ON projects (name);

CREATE INDEX IF NOT EXISTS idx_pallets_maintenance_required
    ON pallets (pallet_id, status)
    WHERE status IN ('Maintenance_Required', 'Damaged', 'Blocked');

CREATE INDEX IF NOT EXISTS idx_pallets_cycles ON pallets (current_cycles DESC, max_cycles);
CREATE INDEX IF NOT EXISTS idx_audit_logs_pallet_timestamp ON pallet_audit_logs (pallet_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON pallet_audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operator ON pallet_audit_logs (operator_id);
