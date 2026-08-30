select
    repayment_code,
    loan_code,
    client_code,
    country_iso3,
    installment_number,
    currency,
    amount_local,
    amount_usd,
    due_on,
    paid_at,
    toDate(paid_at) as paid_on,
    formatDateTime(paid_at, '%Y-%m') as paid_period,
    days_late,
    on_time,
    method,
    ts_ms as source_ts_ms
from {{ source('cdc_raw', 'raw_loan_repayments') }}
final
