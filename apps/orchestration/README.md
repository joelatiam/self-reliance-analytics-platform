# orchestration

Airflow: automates the full pipeline end-to-end on a schedule (and on demand).

## Layout

```
Dockerfile          apache/airflow base + ingestion deps + a dedicated dbt venv
dags/
  worldbank_pipeline_dag.py
```

## The DAG

`worldbank_indicators_pipeline`, scheduled every 6 hours (`0 */6 * * *`), also triggerable manually:

```
ingest_worldbank_api  ┐
                       ├─▶ wait_for_cdc_sync ─▶ dbt_build
ingest_refugee_stats  ┘
```

- `ingest_worldbank_api` / `ingest_refugee_stats` — run in parallel, call straight into [`apps/ingestion`](../ingestion/README.md)'s `main.py`.
- `wait_for_cdc_sync` — polls Postgres vs. ClickHouse row counts (both `observations` and `refugee_statistics`) until they match or a max-attempts timeout is hit, since Debezium replication is near-real-time but async.
- `dbt_build` — runs `dbt build` against [`apps/transformation`](../transformation/README.md) via the dedicated dbt venv.

Runs with `SequentialExecutor` + SQLite — intentionally minimal for a self-contained dev/demo setup (see the design report's scaling section for the production alternative).

## Access

- UI: http://localhost:8080 (`admin` / `admin`, see `.env`)
- Trigger manually: `docker exec wb-airflow-scheduler airflow dags trigger worldbank_indicators_pipeline`
- Check task states: `docker exec wb-airflow-scheduler airflow tasks states-for-dag-run worldbank_indicators_pipeline <run_id>`
