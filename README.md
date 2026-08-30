# World Bank Indicators Pipeline

An end-to-end analytics engineering pipeline: World Bank REST API → Postgres → Debezium CDC → ClickHouse → dbt → Airflow, with Prometheus/Grafana observability and GitHub Actions CI/CD. Built as a take-home assessment for Inkomoko's Senior Data Engineer role.

See [`docs/design_report.md`](docs/design_report.md) for architecture, data model/ERD, ClickHouse design rationale, observability design, and scaling notes.

## Repo layout (monorepo)

```
apps/
  ingestion/       World Bank + UNHCR API clients -> Postgres
  cdc/              Debezium connector config + registration
  warehouse/        ClickHouse Kafka sources, raw tables, materialized views
  transformation/   dbt project (staging -> marts)
  orchestration/    Airflow DAG + image
  observability/    Custom Prometheus exporter, Prometheus/Grafana config
docs/               Design report
docker-compose.yml  Single-command stack
```

Each app has its own README with details specific to it:

- [apps/ingestion](apps/ingestion/README.md)
- [apps/cdc](apps/cdc/README.md)
- [apps/warehouse](apps/warehouse/README.md)
- [apps/transformation](apps/transformation/README.md)
- [apps/orchestration](apps/orchestration/README.md)
- [apps/observability](apps/observability/README.md)

## Dependencies

- Docker + Docker Compose v2
- Nothing else — all app dependencies (Python, dbt, Airflow, etc.) are installed inside the containers.

## Run it end-to-end

```bash
cp .env.example .env
docker compose up -d
```

That's the entire startup — one command. It builds and starts: Postgres, Kafka (KRaft mode), Kafka Connect (with the Debezium Postgres connector auto-registered by the one-shot `connector-init` service), ClickHouse (with the Kafka-consuming tables/materialized views/raw tables already created), Airflow (webserver + scheduler), the custom metrics exporter, Prometheus, and Grafana.

Give it 1–2 minutes for every health check to turn green, then check status:

```bash
docker compose ps
```

Trigger a full pipeline run (or just wait for the 6-hourly schedule):

```bash
docker exec wb-airflow-scheduler airflow dags trigger worldbank_indicators_pipeline
```

## Validating that data moved through each stage

```bash
# 1. Postgres (OLTP) — ingested rows
docker exec wb-postgres psql -U wb_app -d worldbank -c "SELECT count(*) FROM observations;"

# 2. Kafka — Debezium is publishing change events
docker exec wb-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list

# 3. ClickHouse raw layer — CDC landed the rows (FINAL dedupes ReplacingMergeTree versions)
docker exec wb-clickhouse clickhouse-client -q "SELECT count() FROM worldbank.raw_observations FINAL"
docker exec wb-clickhouse clickhouse-client -q "SELECT count() FROM worldbank.raw_refugee_statistics FINAL"

# 4. dbt staging/marts — transformations ran
docker exec wb-clickhouse clickhouse-client -q "SELECT count() FROM worldbank.mart_country_indicators"

# 5. Connector health directly from Kafka Connect's REST API
curl -s http://localhost:8083/connectors/wb-postgres-source/status
```

If Postgres and ClickHouse row counts (step 1 vs step 3) match, replication is caught up — this is exactly what the `wb_pipeline_cdc_lag_rows` metric in Grafana tracks continuously.

## Data sources

**[World Bank Open Data API](https://api.worldbank.org/v2)** — no authentication required. Example request used by the ingestion app:

```
https://api.worldbank.org/v2/country/RW/indicator/NY.GDP.MKTP.KD.ZG?format=json&date=2018:2023
```

Countries and indicators pulled are configured via `.env` (`WORLD_BANK_COUNTRIES`, `WORLD_BANK_INDICATORS`) — defaults to Inkomoko's five operating countries (Rwanda, Kenya, Ethiopia, South Sudan, Chad) and four economic/financial-inclusion indicators (GDP growth, unemployment, poverty headcount, account ownership).

**[UNHCR Refugee Population Statistics API](https://api.unhcr.org/population/v1/population/)** — also no authentication required. Pulls yearly displacement data (refugees, asylum seekers, IDPs, stateless persons) hosted by each of the same five countries:

```
https://api.unhcr.org/population/v1/population/?coa=RWA&yearFrom=2015&yearTo=2023
```

Configured via `.env` (`UNHCR_COUNTRIES`, using ISO3 codes, `UNHCR_YEAR_FROM`, `UNHCR_YEAR_TO`). Note: the API returns no rows for Chad (`TCD`) as a host country — a real data gap upstream, not a pipeline issue.

## Accessing things

| Service | URL | Credentials |
|---|---|---|
| Postgres (OLTP) | `localhost:5433` (mapped from container port 5432 — 5432 is remapped to avoid clashing with a locally-installed Postgres) | `wb_app` / `wb_app_pw` (see `.env`) |
| ClickHouse (HTTP) | http://localhost:8123 | `default` / `clickhouse_pw` (see `.env`) |
| ClickHouse (native) | `localhost:9000` | same as above |
| Kafka Connect REST API | http://localhost:8083 | none |
| Airflow UI | http://localhost:8080 | `admin` / `admin` (see `.env`, `AIRFLOW_ADMIN_*`) |
| Prometheus | http://localhost:9090 | none |
| Grafana | http://localhost:3000 | `admin` / `admin` (see `.env`, `GRAFANA_ADMIN_*`) — "World Bank Pipeline Overview" dashboard is auto-provisioned |
| Metrics exporter (raw) | http://localhost:9105/metrics | none |

All credentials above are local development defaults defined in `.env.example` — change them before deploying anywhere shared.

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main` or `develop`:

1. **`ingestion-tests`** — lints `apps/ingestion` and `apps/orchestration/dags` with `ruff`, then runs the `pytest` unit tests for the World Bank API parsing logic (`apps/ingestion/tests`).
2. **`dbt-build`** — spins up a ClickHouse service container, seeds it with representative rows (standing in for what CDC would normally land), then runs `dbt build` (models + tests) against it. This validates the staging/mart SQL and all dbt tests compile and pass before anything merges.

## Git workflow

`main` holds the stable, working state; `develop` is the integration branch. Each implementation (ingestion, CDC, warehouse, transformation, orchestration, CI/CD, observability) was built on its own branch and merged into `develop` via a merge commit; `develop` is merged into `main` at verified milestones.
