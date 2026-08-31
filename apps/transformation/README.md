# transformation

dbt project: turns the CDC-landed raw tables into clean staging views and analytics-ready marts, on ClickHouse.

## Layout

```
models/staging/    Deduplicated (FINAL), typed views over the raw layer.
                    Country aggregates: stg_countries, stg_indicators,
                      stg_observations, stg_refugee_statistics
                    Client activity:    stg_clients, stg_businesses, stg_loans,
                      stg_loan_repayments, stg_advisory_sessions, stg_business_metrics
models/marts/       mart_country_indicators        denormalized economic indicators fact table
                    mart_indicator_yoy_growth       year-over-year change (window function)
                    mart_country_refugee_stats      displacement stats + total_displaced_hosted
                    mart_client_portfolio           caseload composition and jobs, per country
                    mart_loan_performance           lending book by country and disbursement month, with PAR30
                    mart_repayment_performance      on-time rate and arrears by country and paid month
                    mart_business_growth            monthly revenue growth by country and sector
                    mart_country_program_context    the join the platform exists for (see below)
dbt_project.yml, profiles.yml
```

## The mart that matters

`mart_country_program_context` is where the three sources meet: what the program
is doing on the ground (clients, businesses, jobs, capital deployed, PAR30) set
against the displacement and economic context of the country it is doing it in
(displaced population hosted from UNHCR, GDP growth from the World Bank).

Reach is expressed as `displaced_clients_per_10k_hosted` rather than a
percentage — real reach into a displaced population of that size is a fraction
of a percent, and a rate that rounds to 0.0 tells the reader nothing.

Some staging models carry derived booleans (`is_displaced`, `is_at_risk`,
`is_outstanding`) so that the definition of "displaced" or "at risk" lives in
exactly one place rather than being re-expressed in every mart that needs it.

Every model has `not_null` / `unique` / `relationships` tests (see `_staging.yml`, `_marts.yml`).

## Run standalone

```bash
pip install -r requirements.txt
export DBT_PROFILES_DIR=.
export CLICKHOUSE_HOST=localhost CLICKHOUSE_HTTP_PORT=8123 CLICKHOUSE_DB=worldbank CLICKHOUSE_USER=default CLICKHOUSE_PASSWORD=clickhouse_pw
dbt build
```

In the running pipeline, Airflow's `dbt_build` task runs this via a dedicated venv (`/opt/dbt-venv`) inside the orchestration image — kept separate from Airflow's own dependencies to avoid version conflicts. See [`apps/orchestration`](../orchestration/README.md).

Design rationale for the ClickHouse-specific model config (engine, `order_by`, `partition_by`) is in [`docs/design_report.md`](../../docs/design_report.md#3-data-model--schema).
