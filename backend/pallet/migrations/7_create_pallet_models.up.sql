CREATE TABLE IF NOT EXISTS pallet_models
(
    id         SERIAL PRIMARY KEY,
    project_id INT         NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
    name       VARCHAR(50) NOT NULL,
    CONSTRAINT pallet_models_name_not_empty
        CHECK (LENGTH(TRIM(name)) BETWEEN 1 AND 50)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pallet_models_project_name_unique_ci
    ON pallet_models (project_id, LOWER(TRIM(name)));

CREATE INDEX IF NOT EXISTS idx_pallet_models_project_name
    ON pallet_models (project_id, name);
