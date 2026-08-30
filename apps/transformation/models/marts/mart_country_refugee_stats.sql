{{ config(
    engine='MergeTree()',
    order_by=['country_iso3', 'year']
) }}

-- Displacement population hosted per country per year, denormalized with
-- country context. This is the population the program's lending actually
-- serves, sitting alongside the economic indicator marts.
select
    r.country_iso3,
    c.name as country_name,
    c.region,
    r.year,
    r.refugees,
    r.asylum_seekers,
    r.returned_refugees,
    r.idps,
    r.stateless,
    r.others_of_concern,
    r.host_community,
    coalesce(r.refugees, 0) + coalesce(r.asylum_seekers, 0)
        + coalesce(r.idps, 0) + coalesce(r.stateless, 0) as total_displaced_hosted
from {{ ref('stg_refugee_statistics') }} r
inner join {{ ref('stg_countries') }} c on r.country_iso3 = c.iso3_code
