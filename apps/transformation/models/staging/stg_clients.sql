-- FINAL collapses the ReplacingMergeTree versions: a client row is replicated
-- again every time their status or details change, and only the latest matters.
select
    client_code,
    first_name,
    last_name,
    gender,
    birth_year,
    is_youth,
    country_iso3,
    country_iso2,
    location_name,
    region,
    in_camp,
    displacement_status,
    origin_country_iso3,
    arrival_year,
    household_size,
    dependents,
    education_level,
    primary_language,
    program_track,
    cohort,
    enrolled_on,
    advisor_code,
    status,
    -- The categories that count as displaced for impact reporting, mirroring
    -- the UNHCR population groups the refugee_statistics source uses.
    --
    -- cast(coalesce(...)) rather than the bare comparison: these status columns
    -- are LowCardinality(Nullable(String)), and a comparison over one yields
    -- LowCardinality(Nullable(UInt8)), which ClickHouse refuses to materialise.
    cast(coalesce(displacement_status in (
        'REFUGEE', 'ASYLUM_SEEKER', 'RETURNED_REFUGEE',
        'IDP', 'RETURNED_IDP', 'STATELESS'
    ), 0) as UInt8) as is_displaced,
    ts_ms as source_ts_ms
from {{ source('cdc_raw', 'raw_clients') }}
final
