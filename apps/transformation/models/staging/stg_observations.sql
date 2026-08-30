select
    country_code,
    indicator_code,
    year,
    value,
    unit,
    obs_status,
    decimal_places,
    ts_ms as source_ts_ms
from {{ source('cdc_raw', 'raw_observations') }}
final
where value is not null
