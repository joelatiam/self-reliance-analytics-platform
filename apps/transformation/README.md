# transformation

dbt project: turns the CDC-landed raw tables into clean staging views and analytics-ready marts, on ClickHouse.

## Layout

```
models/staging/    stg_countries, stg_indicators, stg_observations, stg_refugee_statistics
                    Deduplicated (FINAL), typed views over the raw layer.
models/marts/       mart_country_indicators       denormalized economic indicators fact table
                    mart_indicator_yoy_growth      year-over-year change (window function)
                    mart_country_refugee_stats     denormalized displacement stats + total_displaced_hosted
dbt_project.yml, profiles.yml
```

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
