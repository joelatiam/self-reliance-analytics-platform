select
    session_code,
    client_code,
    business_code,
    country_iso3,
    advisor_code,
    session_type,
    topic,
    language,
    delivered_at,
    formatDateTime(delivered_at, '%Y-%m') as delivered_period,
    duration_minutes,
    attended,
    satisfaction_score,
    ts_ms as source_ts_ms
from {{ source('cdc_raw', 'raw_advisory_sessions') }}
final
