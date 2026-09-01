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

-- Preserve the model values already used by existing pallets.
INSERT INTO pallet_models (project_id, name)
SELECT projects.id, MIN(TRIM(pallets.model))
FROM pallets
JOIN projects ON LOWER(TRIM(projects.name)) = LOWER(TRIM(pallets.project))
WHERE LENGTH(TRIM(pallets.model)) BETWEEN 1 AND 50
GROUP BY projects.id, LOWER(TRIM(pallets.model))
ON CONFLICT DO NOTHING;
