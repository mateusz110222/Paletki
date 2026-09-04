ALTER TABLE production_stations
    DROP CONSTRAINT production_stations_pkey;

ALTER TABLE production_stations
    ADD PRIMARY KEY (station, pallet_id);

CREATE INDEX IF NOT EXISTS idx_production_stations_recent
    ON production_stations (station, updated_at DESC, pallet_id DESC);
