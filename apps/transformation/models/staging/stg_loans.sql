select
    loan_code,
    client_code,
    business_code,
    country_iso3,
    loan_cycle,
    currency,
    principal_local,
    principal_usd,
    interest_rate_annual,
    term_months,
    purpose,
    risk_grade,
    applied_on,
    disbursed_on,
    maturity_on,
    installments_total,
    installments_paid,
    total_repayable_usd,
    amount_repaid_usd,
    outstanding_usd,
    days_past_due,
    status,
    disbursed_on is not null as is_disbursed,
    -- cast(coalesce(...)) because status is LowCardinality(Nullable(String)),
    -- and a comparison over one yields LowCardinality(Nullable(UInt8)), which
    -- ClickHouse refuses to materialise.
    cast(coalesce(status in ('DISBURSED', 'REPAYING', 'LATE'), 0) as UInt8) as is_outstanding,
    -- Portfolio at risk is conventionally measured at 30 days past due.
    cast(coalesce(days_past_due, 0) > 30 as UInt8) as is_at_risk,
    cast(coalesce(status in ('DEFAULTED', 'WRITTEN_OFF'), 0) as UInt8) as is_written_off,
    ts_ms as source_ts_ms
from {{ source('cdc_raw', 'raw_loans') }}
final
