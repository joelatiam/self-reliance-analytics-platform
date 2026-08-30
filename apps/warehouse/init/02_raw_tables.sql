-- Raw (CDC-landed) layer: one ReplacingMergeTree per source table.
-- ts_ms (Debezium event timestamp) is the version column, so a later
-- update for the same key always wins on merge / with FINAL.

CREATE TABLE IF NOT EXISTS worldbank.raw_countries
(
    iso2_code    String,
    iso3_code    Nullable(String),
    name         String,
    region       Nullable(String),
    income_level Nullable(String),
    capital_city Nullable(String),
    longitude    Nullable(Float64),
    latitude     Nullable(Float64),
    op           LowCardinality(String),
    ts_ms        Int64,
    _loaded_at   DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(ts_ms)
ORDER BY iso2_code;

CREATE TABLE IF NOT EXISTS worldbank.raw_indicators
(
    code                String,
    name                String,
    source_note         Nullable(String),
    source_organization Nullable(String),
    op                  LowCardinality(String),
    ts_ms               Int64,
    _loaded_at          DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(ts_ms)
ORDER BY code;

CREATE TABLE IF NOT EXISTS worldbank.raw_observations
(
    country_code   String,
    indicator_code String,
    year           Int32,
    value          Nullable(Float64),
    unit           Nullable(String),
    obs_status     Nullable(String),
    decimal_places Nullable(Int32),
    op             LowCardinality(String),
    ts_ms          Int64,
    _loaded_at     DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(ts_ms)
ORDER BY (country_code, indicator_code, year);
