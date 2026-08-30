-- OLTP schema for World Bank reference + observation data.
-- Debezium captures changes on these tables via logical replication.

CREATE TABLE IF NOT EXISTS countries (
    id              SERIAL PRIMARY KEY,
    iso2_code       TEXT NOT NULL UNIQUE,
    iso3_code       TEXT,
    name            TEXT NOT NULL,
    region          TEXT,
    income_level    TEXT,
    capital_city    TEXT,
    longitude       DOUBLE PRECISION,
    latitude        DOUBLE PRECISION,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS indicators (
    id                  SERIAL PRIMARY KEY,
    code                TEXT NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    source_note         TEXT,
    source_organization TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS observations (
    id              BIGSERIAL PRIMARY KEY,
    country_code    TEXT NOT NULL REFERENCES countries (iso2_code),
    indicator_code  TEXT NOT NULL REFERENCES indicators (code),
    year            INTEGER NOT NULL,
    value           DOUBLE PRECISION,
    unit            TEXT,
    obs_status      TEXT,
    decimal_places  INTEGER,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (country_code, indicator_code, year)
);

CREATE INDEX IF NOT EXISTS idx_observations_country_indicator
    ON observations (country_code, indicator_code);

-- Debezium's default replica identity (primary key) is enough since this
-- pipeline only needs INSERT/UPDATE change events, not full-row deletes.
ALTER TABLE observations REPLICA IDENTITY DEFAULT;
