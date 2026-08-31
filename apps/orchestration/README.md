# orchestration

Airflow: automates the full pipeline end-to-end on a schedule (and on demand).

## Layout

```
Dockerfile          apache/airflow base + ingestion deps + a dedicated dbt venv
dags/
  cdc_sync.py                          Shared "wait for ClickHouse to catch up" helper
  country_indicators_pipeline_dag.py   Six-hourly: World Bank + UNHCR aggregates
  client_activity_dag.py               Ten-minute: operational client activity
```

## The DAGs

Two, because the sources move at completely different speeds. Yearly country
aggregates on a ten-minute schedule would be pure waste; operational client
activity on a six-hourly one would be six hours stale.

`country_indicators_pipeline`, scheduled every 6 hours (`0 */6 * * *`), also triggerable manually:

```
ingest_worldbank_api  ┐
                       ├─▶ wait_for_cdc_sync ─▶ dbt_build
ingest_refugee_stats  ┘
```

- `ingest_worldbank_api` / `ingest_refugee_stats` — run in parallel, call straight into [`apps/ingestion`](../ingestion/README.md)'s `main.py`.
- `wait_for_cdc_sync` — polls Postgres vs. ClickHouse row counts (both `observations` and `refugee_statistics`) until they match or a max-attempts timeout is hit, since Debezium replication is near-real-time but async.
- `dbt_build` — runs `dbt build` against [`apps/transformation`](../transformation/README.md) via the dedicated dbt venv.

### `client_activity_pipeline`

Scheduled every ten minutes (`*/10 * * * *`), `max_active_runs=1`:

```
ingest_client_activity ─▶ wait_for_cdc_sync ─▶ dbt_build_client_models
```

- `ingest_client_activity` — calls `run_client_activity()`, which pulls each resource from the [clients API](../clients-api/README.md) incrementally from its own watermark.
- `wait_for_cdc_sync` — same helper, against the six client-activity tables.
- `dbt_build_client_models` — `dbt build --select +mart_country_program_context +mart_loan_performance +mart_repayment_performance +mart_business_growth`. The leading `+` pulls in ancestors, so the run builds the World Bank and UNHCR models it joins against instead of assuming the six-hourly DAG got there first.

**The schedules are deliberately offset.** The source generates activity five minutes into each ten-minute window (:05, :15, :25, ...) and this DAG runs on the boundary (:00, :10, :20, ...), so a pull always reads data that settled five minutes earlier and never races a half-written batch.

Runs with `SequentialExecutor` + SQLite — intentionally minimal for a self-contained dev/demo setup (see the design report's scaling section for the production alternative).

## Access

- UI: http://localhost:8080 (`admin` / `admin`, see `.env`)
- Trigger manually: `docker exec wb-airflow-scheduler airflow dags trigger country_indicators_pipeline`
- Trigger the client pipeline: `docker exec wb-airflow-scheduler airflow dags trigger client_activity_pipeline`
- Check task states: `docker exec wb-airflow-scheduler airflow tasks states-for-dag-run country_indicators_pipeline <run_id>`
