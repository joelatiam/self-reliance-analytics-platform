select
    country_iso3,
    year,
    refugees,
    asylum_seekers,
    returned_refugees,
    idps,
    returned_idps,
    stateless,
    others_of_concern,
    host_community,
    ts_ms as source_ts_ms
from {{ source('cdc_raw', 'raw_refugee_statistics') }}
final
