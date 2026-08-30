select
    code,
    name,
    source_note,
    source_organization,
    ts_ms as source_ts_ms
from {{ source('cdc_raw', 'raw_indicators') }}
final
