CREATE TABLE IF NOT EXISTS soldering_cycle_events
(
    event_id               VARCHAR(64)  PRIMARY KEY,
    pallet_id              VARCHAR(50)  NOT NULL,
    station                VARCHAR(64)  NOT NULL,
    process                VARCHAR(100) NOT NULL,
    unit_ids               JSONB        NOT NULL,
    state                  VARCHAR(16)  NOT NULL DEFAULT 'claimed',
    result_current_cycles  INT,
    result_total_cycles    INT,
    result_pallet_status   VARCHAR(50),
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    finalized_at           TIMESTAMPTZ,
    CONSTRAINT soldering_cycle_event_id_format
        CHECK (event_id ~ '^[a-f0-9]{64}$'),
    CONSTRAINT soldering_cycle_event_units_array
        CHECK (jsonb_typeof(unit_ids) = 'array' AND jsonb_array_length(unit_ids) BETWEEN 1 AND 10000),
    CONSTRAINT soldering_cycle_event_state_supported
        CHECK (state IN ('claimed', 'recorded')),
    CONSTRAINT soldering_cycle_event_result_consistent
        CHECK (
            (state = 'claimed'
                AND result_current_cycles IS NULL
                AND result_total_cycles IS NULL
                AND result_pallet_status IS NULL
                AND finalized_at IS NULL)
            OR
            (state = 'recorded'
                AND result_current_cycles IS NOT NULL
                AND result_total_cycles IS NOT NULL
                AND result_pallet_status IN ('Active', 'Washing_Required', 'Damaged', 'Blocked')
                AND finalized_at IS NOT NULL)
        )
);

CREATE INDEX IF NOT EXISTS idx_soldering_cycle_events_pallet_created
    ON soldering_cycle_events (pallet_id, created_at DESC);
