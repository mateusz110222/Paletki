CREATE TABLE pallet_strain_measurements (
    pallet_id INT NOT NULL REFERENCES pallets (id) ON DELETE RESTRICT,
    pallet_created_at TIMESTAMPTZ NOT NULL,
    measured_on DATE NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    recorded_by VARCHAR(256) NOT NULL,
    PRIMARY KEY (pallet_id, pallet_created_at, measured_on)
);

CREATE VIEW pallet_strain_status AS
SELECT p.id, p.pallet_id, p.project, p.model, measurement.measured_on,
       measurement.measured_on + 365 AS due_on,
       CASE
           WHEN measurement.measured_on IS NULL THEN 'missing'
           WHEN measurement.measured_on + 365 < local_day.today THEN 'expired'
           WHEN measurement.measured_on + 365 <= local_day.today + 30 THEN 'due_soon'
           ELSE 'current'
       END AS strain_status
FROM pallet_details p
CROSS JOIN LATERAL (SELECT (statement_timestamp() AT TIME ZONE 'Europe/Warsaw')::date AS today) local_day
LEFT JOIN LATERAL (
    SELECT measured_on
    FROM pallet_strain_measurements
    WHERE pallet_id = p.id AND pallet_created_at = p.created_at
    ORDER BY measured_on DESC
    LIMIT 1
) measurement ON true
WHERE p.deleted_at IS NULL;
