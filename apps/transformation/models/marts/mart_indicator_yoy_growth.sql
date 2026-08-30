{{ config(
    engine='MergeTree()',
    order_by=['indicator_code', 'country_code', 'year'],
    partition_by='indicator_code'
) }}

-- Year-over-year change per country/indicator, built on top of the
-- denormalized fact table rather than re-joining the staging layer.
select
    country_code,
    country_name,
    region,
    indicator_code,
    indicator_name,
    year,
    value,
    lagInFrame(value) over (
        partition by country_code, indicator_code order by year
    ) as prior_year_value,
    value - lagInFrame(value) over (
        partition by country_code, indicator_code order by year
    ) as yoy_change
from {{ ref('mart_country_indicators') }}
