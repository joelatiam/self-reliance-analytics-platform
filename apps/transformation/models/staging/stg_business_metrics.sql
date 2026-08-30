select
    business_code,
    period,
    client_code,
    country_iso3,
    currency,
    revenue_local,
    revenue_usd,
    profit_usd,
    employees_total,
    customers_served,
    revenue_growth_pct,
    ts_ms as source_ts_ms
from {{ source('cdc_raw', 'raw_business_monthly_metrics') }}
final
