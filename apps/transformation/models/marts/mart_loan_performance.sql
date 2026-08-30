{{ config(
    engine='MergeTree()',
    order_by=['country_iso3', 'disbursement_month']
) }}

-- Lending book by country and disbursement month. Portfolio at risk is measured
-- at 30 days past due, the usual microfinance convention, so it is comparable
-- with how the sector reports.
--
-- The aggregates are computed in a CTE with distinct names: aliasing a sum back
-- to its own source column shadows it, and ClickHouse then reads the second
-- reference as an aggregate nested inside an aggregate and refuses the query.
with loan_aggregates as (
    select
        country_iso3,
        -- assumeNotNull is safe under `where is_disbursed`, and necessary
        -- because a MergeTree sorting key cannot be nullable.
        toStartOfMonth(assumeNotNull(disbursed_on)) as disbursement_month,
        count(*)                                    as loans_disbursed,
        coalesce(sum(principal_usd), 0)             as principal_total_usd,
        avg(principal_usd)                          as avg_principal_usd,
        avg(interest_rate_annual)                   as avg_rate,
        avg(term_months)                            as avg_term,
        countIf(loan_cycle = 1)                     as first_cycle_loans,
        countIf(loan_cycle > 1)                     as repeat_cycle_loans,
        coalesce(sum(amount_repaid_usd), 0)         as repaid_total_usd,
        coalesce(sumIf(outstanding_usd, is_outstanding), 0) as outstanding_total_usd,
        coalesce(sumIf(outstanding_usd, is_at_risk), 0)     as at_risk_total_usd,
        countIf(is_at_risk)                         as loans_at_risk,
        countIf(status = 'REPAID')                  as loans_fully_repaid,
        countIf(is_written_off)                     as loans_written_off
    from {{ ref('stg_loans') }}
    where is_disbursed
    group by country_iso3, disbursement_month
)

select
    country_iso3,
    disbursement_month,
    loans_disbursed,
    principal_total_usd                                     as principal_disbursed_usd,
    round(avg_principal_usd, 2)                             as avg_loan_size_usd,
    round(avg_rate, 2)                                      as avg_interest_rate_annual,
    round(avg_term, 1)                                      as avg_term_months,
    first_cycle_loans,
    repeat_cycle_loans,
    repaid_total_usd                                        as repaid_usd,
    outstanding_total_usd                                   as outstanding_usd,
    at_risk_total_usd                                       as at_risk_usd,
    loans_at_risk,
    loans_fully_repaid,
    loans_written_off,
    round(
        if(outstanding_total_usd > 0, at_risk_total_usd / outstanding_total_usd * 100, 0),
        2
    )                                                       as par30_pct,
    round(
        if(loans_disbursed > 0, loans_written_off / loans_disbursed * 100, 0),
        2
    )                                                       as write_off_rate_pct
from loan_aggregates
