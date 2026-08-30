-- FINAL forces dedup of ReplacingMergeTree versions at query time,
-- since background merges only run periodically.
select
    iso2_code,
    iso3_code,
    name,
    region,
    income_level,
    capital_city,
    longitude,
    latitude,
    ts_ms as source_ts_ms
from {{ source('cdc_raw', 'raw_countries') }}
final
