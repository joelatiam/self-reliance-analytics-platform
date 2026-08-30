{{ config(
    engine='MergeTree()',
    order_by=['indicator_code', 'country_code', 'year'],
    partition_by='indicator_code'
) }}

-- Denormalized, analytics-ready fact table: one row per
-- country x indicator x year, ordered/partitioned for the
-- "trend by indicator" queries this pipeline is built for.
select
    o.country_code,
    c.name as country_name,
    c.region,
    c.income_level,
    o.indicator_code,
    i.name as indicator_name,
    o.year,
    o.value
from {{ ref('stg_observations') }} o
inner join {{ ref('stg_countries') }} c on o.country_code = c.iso2_code
inner join {{ ref('stg_indicators') }} i on o.indicator_code = i.code
