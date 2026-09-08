CREATE TABLE IF NOT EXISTS pallets
(
    id                 SERIAL PRIMARY KEY,
    pallet_id          VARCHAR(50)  NOT NULL UNIQUE,
    project_id         INT          NOT NULL,
    model_id           INT          NOT NULL,
    max_cycles         INT          NOT NULL DEFAULT 200,
    current_cycles     INT          NOT NULL DEFAULT 0,
    total_cycles       INT          NOT NULL DEFAULT 0,
    nests              INT          NOT NULL DEFAULT 1,
    status             VARCHAR(50)  NOT NULL DEFAULT 'Active',
    block_reason       TEXT,
    fis                INT          NOT NULL DEFAULT 1,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by         VARCHAR(100) NOT NULL,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by         VARCHAR(100),
    last_operation_description TEXT,
    deleted_at         TIMESTAMPTZ,
    deleted_by         VARCHAR(100),
    CONSTRAINT pallets_status_supported
        CHECK (status IN ('Active', 'Washing_Required', 'Damaged', 'Blocked')),
    CONSTRAINT pallets_positive_values
        CHECK (max_cycles > 0 AND nests > 0 AND fis IN (1, 2)),
    CONSTRAINT pallets_contract_limits CHECK (max_cycles <= 1000000 AND nests <= 10000),
    CONSTRAINT pallets_project_fk FOREIGN KEY (project_id)
        REFERENCES projects (id) ON DELETE RESTRICT,
    CONSTRAINT pallets_model_project_fk FOREIGN KEY (model_id, project_id)
        REFERENCES pallet_models (id, project_id) ON DELETE RESTRICT
);


CREATE INDEX IF NOT EXISTS idx_pallets_status ON pallets (status);

CREATE INDEX IF NOT EXISTS idx_pallets_created_by ON pallets (created_by);

CREATE INDEX IF NOT EXISTS idx_pallets_maintenance_required
    ON pallets (pallet_id, status)
    WHERE status IN ('Washing_Required', 'Damaged', 'Blocked');

CREATE INDEX IF NOT EXISTS idx_pallets_cycles ON pallets (current_cycles DESC, max_cycles);

CREATE INDEX IF NOT EXISTS idx_pallets_active_id
    ON pallets (id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pallets_upper_pallet_id
    ON pallets (UPPER(pallet_id))
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pallets_upper_created_by
    ON pallets (UPPER(created_by))
    WHERE deleted_at IS NULL;

CREATE INDEX idx_pallets_project_id_status ON pallets(project_id, status);
CREATE INDEX idx_pallets_model_id ON pallets(model_id);

-- All public names are resolved through references; no copied names on pallets.
CREATE VIEW pallet_details AS
SELECT a.*, p.name AS project, m.name AS model
FROM pallets a JOIN projects p ON p.id = a.project_id
JOIN pallet_models m ON m.id = a.model_id AND m.project_id = a.project_id;
