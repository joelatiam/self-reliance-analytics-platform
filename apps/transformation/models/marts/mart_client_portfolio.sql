{{ config(
    engine='MergeTree()',
    order_by=['country_iso3']
) }}

-- Who the program actually reaches, per country: caseload composition and the
-- jobs the businesses behind it support. This is the operational counterpart to
-- mart_country_refugee_stats, which counts the displaced population hosted.
with clients as (
    select * from {{ ref('stg_clients') }}
),

businesses as (
    select
        country_iso3,
        count(*)                                as businesses_total,
        countIf(status = 'ACTIVE')              as businesses_active,
        sum(employees_total)                    as jobs_supported,
        sum(coalesce(employees_female, 0))      as jobs_held_by_women,
        sum(coalesce(employees_displaced, 0))   as jobs_held_by_displaced,
        avg(revenue_growth_pct)                 as avg_revenue_growth_pct,
        sum(monthly_revenue_usd)                as monthly_revenue_usd
    from {{ ref('stg_businesses') }}
    group by country_iso3
)

select
    c.country_iso3,
    count(*)                                            as clients_total,
    countIf(c.status in ('ACTIVE', 'ENROLLED'))         as clients_active,
    countIf(c.is_displaced)                             as clients_displaced,
    countIf(c.displacement_status = 'HOST_COMMUNITY')   as clients_host_community,
    countIf(c.gender = 'FEMALE')                        as clients_women,
    countIf(c.is_youth)                                 as clients_youth,
    countIf(c.in_camp)                                  as clients_in_camp,
    countIf(c.status = 'GRADUATED')                     as clients_graduated,
    round(countIf(c.gender = 'FEMALE') / count(*) * 100, 2)  as women_share_pct,
    round(countIf(c.is_youth) / count(*) * 100, 2)           as youth_share_pct,
    round(countIf(c.is_displaced) / count(*) * 100, 2)       as displaced_share_pct,
    sum(coalesce(c.household_size, 0))                  as household_members_reached,
    coalesce(b.businesses_total, 0)                     as businesses_total,
    coalesce(b.businesses_active, 0)                    as businesses_active,
    coalesce(b.jobs_supported, 0)                       as jobs_supported,
    coalesce(b.jobs_held_by_women, 0)                   as jobs_held_by_women,
    coalesce(b.jobs_held_by_displaced, 0)               as jobs_held_by_displaced,
    round(b.avg_revenue_growth_pct, 2)                  as avg_revenue_growth_pct,
    round(b.monthly_revenue_usd, 2)                     as monthly_revenue_usd
from clients c
left join businesses b on c.country_iso3 = b.country_iso3
group by
    c.country_iso3,
    b.businesses_total,
    b.businesses_active,
    b.jobs_supported,
    b.jobs_held_by_women,
    b.jobs_held_by_displaced,
    b.avg_revenue_growth_pct,
    b.monthly_revenue_usd
