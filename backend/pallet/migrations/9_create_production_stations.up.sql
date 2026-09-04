CREATE TABLE IF NOT EXISTS production_stations
(
    station     VARCHAR(64) PRIMARY KEY,
    pallet_id   VARCHAR(50) NOT NULL REFERENCES pallets (pallet_id) ON UPDATE CASCADE,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT production_stations_station_not_blank CHECK (LENGTH(TRIM(station)) BETWEEN 1 AND 64)
);

CREATE INDEX IF NOT EXISTS idx_production_stations_pallet_id
    ON production_stations (pallet_id);
