select
    business_code,
    client_code,
    name,
    sector,
    sub_sector,
    stage,
    registration_status,
    market_access,
    country_iso3,
    location_name,
    started_year,
    employees_full_time,
    employees_part_time,
    coalesce(employees_full_time, 0) + coalesce(employees_part_time, 0) as employees_total,
    employees_female,
    employees_displaced,
    currency,
    monthly_revenue_local,
    monthly_revenue_usd,
    monthly_profit_usd,
    baseline_monthly_revenue_usd,
    -- Growth against the revenue captured when the client enrolled, which is
    -- the number the program reports its impact in.
    if(
        baseline_monthly_revenue_usd > 0,
        (monthly_revenue_usd - baseline_monthly_revenue_usd) / baseline_monthly_revenue_usd * 100,
        null
    ) as revenue_growth_pct,
    status,
    ts_ms as source_ts_ms
from {{ source('cdc_raw', 'raw_businesses') }}
final
