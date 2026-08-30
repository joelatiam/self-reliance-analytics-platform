{{ config(
    engine='MergeTree()',
    order_by=['country_iso3', 'paid_period']
) }}

-- Repayment behaviour by country and the month the installment was actually
-- paid. The on-time share is the headline number for a below-market lender:
-- the model only works while it stays high.
select
    country_iso3,
    -- Non-nullable for the sorting key; the where clause below guarantees the
    -- value is really there.
    assumeNotNull(paid_period)                        as paid_period,
    count(*)                                          as repayments_recorded,
    countIf(on_time)                                  as on_time_repayments,
    countIf(not on_time)                              as late_repayments,
    round(
        if(count(*) > 0, countIf(on_time) / count(*) * 100, 0),
        2
    )                                                 as on_time_rate_pct,
    sum(amount_usd)                                   as amount_repaid_usd,
    round(avg(amount_usd), 2)                         as avg_installment_usd,
    round(avgIf(days_late, not on_time), 1)           as avg_days_late_when_late,
    max(days_late)                                    as max_days_late,
    countIf(method = 'MOBILE_MONEY')                  as mobile_money_repayments,
    round(
        if(count(*) > 0, countIf(method = 'MOBILE_MONEY') / count(*) * 100, 0),
        2
    )                                                 as mobile_money_share_pct
from {{ ref('stg_loan_repayments') }}
where paid_at is not null
group by country_iso3, paid_period
