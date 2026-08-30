{{ config(
    engine='MergeTree()',
    order_by=['country_iso3']
) }}

-- The join the whole platform exists for: what the program is doing on the
-- ground, set against the displacement and economic context of the country it
-- is doing it in. Reach is deliberately expressed against the hosted displaced
-- population, so "1,200 clients" becomes a share of the people who need it.
with latest_refugee_stats as (
    select
        country_iso3,
        argMax(total_displaced_hosted, year) as displaced_hosted,
        max(year)                            as displacement_year
    from {{ ref('mart_country_refugee_stats') }}
    group by country_iso3
),

latest_gdp_growth as (
    select
        c.iso3_code                          as country_iso3,
        argMax(o.value, o.year)              as gdp_growth_pct,
        max(o.year)                          as gdp_growth_year
    from {{ ref('stg_observations') }} o
    inner join {{ ref('stg_countries') }} c on o.country_code = c.iso2_code
    where o.indicator_code = 'NY.GDP.MKTP.KD.ZG' and o.value is not null
    group by c.iso3_code
),

-- Distinct alias names in the inner query: aliasing a sum back to its own
-- source column shadows it, and ClickHouse then reads the next reference as a
-- nested aggregate.
lending as (
    select
        country_iso3,
        loans_total,
        principal_total_usd                     as principal_disbursed_usd,
        outstanding_total_usd                   as outstanding_usd,
        round(
            if(outstanding_total_usd > 0, at_risk_total_usd / outstanding_total_usd * 100, 0),
            2
        )                                       as par30_pct
    from (
        select
            country_iso3,
            count(*)                                            as loans_total,
            coalesce(sumIf(principal_usd, is_disbursed), 0)     as principal_total_usd,
            coalesce(sumIf(outstanding_usd, is_outstanding), 0) as outstanding_total_usd,
            coalesce(sumIf(outstanding_usd, is_at_risk), 0)     as at_risk_total_usd
        from {{ ref('stg_loans') }}
        group by country_iso3
    )
)

select
    -- Aliased explicitly: three of the joined relations expose a country_iso3,
    -- so the bare name is ambiguous when ClickHouse resolves the sorting key.
    p.country_iso3                                as country_iso3,
    c.name                                        as country_name,
    c.region,
    p.clients_total,
    p.clients_displaced,
    p.clients_women,
    p.clients_youth,
    p.businesses_active,
    p.jobs_supported,
    p.avg_revenue_growth_pct,
    coalesce(l.loans_total, 0)                    as loans_total,
    round(coalesce(l.principal_disbursed_usd, 0), 2) as principal_disbursed_usd,
    round(coalesce(l.outstanding_usd, 0), 2)      as outstanding_usd,
    coalesce(l.par30_pct, 0)                      as par30_pct,
    r.displaced_hosted,
    r.displacement_year,
    -- Per 10,000 rather than a percentage: real reach into a displaced
    -- population of this size is a fraction of a percent, and a rate that
    -- rounds to 0.0 tells the reader nothing.
    round(
        if(r.displaced_hosted > 0, p.clients_displaced / r.displaced_hosted * 10000, 0),
        2
    )                                             as displaced_clients_per_10k_hosted,
    round(g.gdp_growth_pct, 2)                    as gdp_growth_pct,
    g.gdp_growth_year
from {{ ref('mart_client_portfolio') }} p
inner join {{ ref('stg_countries') }} c on p.country_iso3 = c.iso3_code
left join latest_refugee_stats r on p.country_iso3 = r.country_iso3
left join latest_gdp_growth g on p.country_iso3 = g.country_iso3
left join lending l on p.country_iso3 = l.country_iso3
