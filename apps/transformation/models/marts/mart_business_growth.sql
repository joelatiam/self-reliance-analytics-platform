{{ config(
    engine='MergeTree()',
    order_by=['country_iso3', 'period']
) }}

-- Monthly business performance by country and sector. Growth is measured
-- against the revenue captured at enrolment, so it answers "did support move
-- the needle" rather than just "how big is this business".
select
    m.country_iso3,
    m.period,
    b.sector,
    count(*)                                    as businesses_reporting,
    sum(m.revenue_usd)                          as revenue_usd,
    sum(m.profit_usd)                           as profit_usd,
    round(avg(m.revenue_usd), 2)                as avg_revenue_usd,
    round(avg(m.revenue_growth_pct), 2)         as avg_revenue_growth_pct,
    round(median(m.revenue_growth_pct), 2)      as median_revenue_growth_pct,
    countIf(m.revenue_growth_pct > 0)           as businesses_growing,
    round(
        if(count(*) > 0, countIf(m.revenue_growth_pct > 0) / count(*) * 100, 0),
        2
    )                                           as growing_share_pct,
    sum(m.employees_total)                      as jobs_supported,
    sum(m.customers_served)                     as customers_served
from {{ ref('stg_business_metrics') }} m
inner join {{ ref('stg_businesses') }} b on m.business_code = b.business_code
group by m.country_iso3, m.period, b.sector
