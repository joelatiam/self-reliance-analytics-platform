# Self-Reliance Analytics Platform

An end-to-end analytics engineering pipeline: three source APIs → Postgres → Debezium CDC → ClickHouse → dbt → Airflow, with Prometheus/Grafana observability and GitHub Actions CI/CD. Built as a take-home assessment for a Senior Data Engineer role.

Two sources are public country-level APIs (World Bank, UNHCR) on a six-hourly schedule. The third is a simulated operational system — the clients API in this repo — pulled incrementally every ten minutes, which is what gives the platform row-level activity to replicate rather than only yearly aggregates.

See [`docs/design_report.md`](docs/design_report.md) for architecture, data model/ERD, ClickHouse design rationale, observability design, and scaling notes.

## Repo layout (monorepo)

```
apps/
  clients-api/      Simulated source system (NestJS): client, business and loan activity
  ingestion/        World Bank + UNHCR API clients -> Postgres
  cdc/              Debezium connector config + registration
  warehouse/        ClickHouse Kafka sources, raw tables, materialized views
  transformation/   dbt project (staging -> marts)
  orchestration/    Airflow DAG + image
  observability/    Custom Prometheus exporter, Prometheus/Grafana config
docs/               Design report
docker-compose.yml  Single-command stack
```

Each app has its own README with details specific to it:

- [apps/clients-api](apps/clients-api/README.md)
- [apps/ingestion](apps/ingestion/README.md)
- [apps/cdc](apps/cdc/README.md)
- [apps/warehouse](apps/warehouse/README.md)
- [apps/transformation](apps/transformation/README.md)
- [apps/orchestration](apps/orchestration/README.md)
- [apps/observability](apps/observability/README.md)

## Dependencies

- Docker + Docker Compose v2, with **at least 6 GB of memory** allocated to the
  Docker VM. The stack runs Kafka, ClickHouse, Airflow and Postgres side by
  side; on a 4 GB default allocation the Kafka and ClickHouse containers get
  OOM-killed (exit code 137) shortly after boot.
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

**If you already have the stack running from an earlier revision**, note that
Postgres and ClickHouse only run their `init/` SQL against an *empty* data
directory. New tables added under `apps/ingestion/sql/` or
`apps/warehouse/init/` will not appear in an existing volume, and the DAG that
needs them fails with `relation ... does not exist`. Reset with:

```bash
docker compose down -v && docker compose up -d
```

Trigger a full pipeline run (or just wait for the 6-hourly schedule):

```bash
docker exec wb-airflow-scheduler airflow dags trigger country_indicators_pipeline
```

The client activity pipeline runs itself every ten minutes, but you can force a pass:

```bash
docker exec wb-airflow-scheduler airflow dags trigger client_activity_pipeline
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
docker exec wb-clickhouse clickhouse-client -q "SELECT count() FROM worldbank.raw_loans FINAL"

# 4. dbt staging/marts — transformations ran
docker exec wb-clickhouse clickhouse-client -q "SELECT count() FROM worldbank.mart_country_indicators"
docker exec wb-clickhouse clickhouse-client -q "SELECT * FROM worldbank.mart_country_program_context FORMAT Vertical"

# 5. Connector health directly from Kafka Connect's REST API
curl -s http://localhost:8083/connectors/wb-postgres-source/status
```

If Postgres and ClickHouse row counts (step 1 vs step 3) match, replication is caught up — this is exactly what the `wb_pipeline_cdc_lag_rows` metric in Grafana tracks continuously, with `wb_pipeline_cdc_lag_rows_by_table` breaking it down per table so one stalled topic cannot hide behind a healthy total.

For the incremental sources, `wb_pipeline_ingestion_watermark_age_seconds` is the faster signal: if a resource's watermark has not advanced in well over ten minutes, the pull has stalled.

```bash
# How far each incremental pull has got
docker exec wb-postgres psql -U wb_app -d worldbank -c "SELECT resource, watermark, rows_ingested FROM ingestion_watermarks ORDER BY resource;"
```

## Data sources

Two of the three are real public APIs. The third is a source system we built and
populate ourselves — it is clearly marked below, and nothing in it is real.

**[World Bank Open Data API](https://api.worldbank.org/v2)** — no authentication required. Example request used by the ingestion app:

```
https://api.worldbank.org/v2/country/RW/indicator/NY.GDP.MKTP.KD.ZG?format=json&date=2018:2023
```

Countries and indicators pulled are configured via `.env` (`WORLD_BANK_COUNTRIES`, `WORLD_BANK_INDICATORS`) — defaults to the program's five operating countries (Rwanda, Kenya, Ethiopia, South Sudan, Chad) and four economic/financial-inclusion indicators (GDP growth, unemployment, poverty headcount, account ownership).

**[UNHCR Refugee Population Statistics API](https://api.unhcr.org/population/v1/population/)** — also no authentication required. Pulls yearly displacement data (refugees, asylum seekers, IDPs, stateless persons) hosted by each of the same five countries:

```
https://api.unhcr.org/population/v1/population/?coa=RWA&yearFrom=2015&yearTo=2023
```

Configured via `.env` (`UNHCR_COUNTRIES`, using ISO3 codes, `UNHCR_YEAR_FROM`, `UNHCR_YEAR_TO`). Note: the API returns no rows for Chad (`TCD`) as a host country — a real data gap upstream, not a pipeline issue.

**Clients API ([`apps/clients-api`](apps/clients-api/README.md)) — ⚠️ fake data, generated by us.** The two public APIs above are yearly country aggregates. Neither tells you anything about individual entrepreneurs, their businesses or their loans, and no such dataset is public — for good reason, since it would be personal data about displaced people. So the operational layer is simulated: a NestJS service we wrote that plays the part of the system a program would run its lending and advisory on, and generates fresh activity on a schedule.

```
http://localhost:4000/api/v1/loans?limit=500&updatedSince=2026-08-30T10:25:00.512Z
```

Every client, business, loan, repayment and coaching session it serves is invented. No real person's data is involved and phone numbers are masked by construction. It exists so the pipeline has a fast-moving, row-level, incrementally-readable source to exercise CDC against — the public APIs change once a year at most.

What it is *not* is uniform noise. Clients are distributed across the five countries by hosted displaced population, nationalities follow the real origin mix per host country, and the repayment and demographic rates are set from published sector figures — so the numbers coming out of the marts behave like the real thing even though none of them are. Details and the generation script are in the [app README](apps/clients-api/README.md).

Configured via `.env` (`CLIENTS_API_BASE_URL`, `CLIENTS_API_KEY`, `CLIENTS_API_PAGE_SIZE`). It writes on the 5th, 15th, 25th, ... minute and the pipeline pulls on the ten-minute boundary, so every fetch reads settled data.

## Accessing things

| Service | URL | Credentials |
|---|---|---|
| Postgres (OLTP) | `localhost:5433` (mapped from container port 5432 — 5432 is remapped to avoid clashing with a locally-installed Postgres) | `wb_app` / `wb_app_pw` (see `.env`) |
| ClickHouse (HTTP) | http://localhost:8123 | `default` / `clickhouse_pw` (see `.env`) |
| ClickHouse (native) | `localhost:9000` | same as above |
| Kafka Connect REST API | http://localhost:8083 | none |
| Airflow UI | http://localhost:8080 | `admin` / `admin` (see `.env`, `AIRFLOW_ADMIN_*`) |
| Prometheus | http://localhost:9090 | none |
| Grafana | http://localhost:3000 | `admin` / `admin` (see `.env`, `GRAFANA_ADMIN_*`) — "Pipeline Overview" dashboard is auto-provisioned |
| Metrics exporter (raw) | http://localhost:9105/metrics | none |
| Clients API (Swagger) | http://localhost:4000/docs | none by default (set `CLIENTS_API_KEY` to require `x-api-key`) |
| Clients API Postgres | `localhost:5434` | `sr_app` / `sr_app_pw` (see `.env`) |

All credentials above are local development defaults defined in `.env.example` — change them before deploying anywhere shared.

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main` or `develop`:

1. **`ingestion-tests`** — lints `apps/ingestion` and `apps/orchestration/dags` with `ruff`, then runs the `pytest` unit tests for the World Bank API parsing logic (`apps/ingestion/tests`).
2. **`dbt-build`** — spins up a ClickHouse service container, seeds it with representative rows (standing in for what CDC would normally land), then runs `dbt build` (models + tests) against it. This validates the staging/mart SQL and all dbt tests compile and pass before anything merges.

## Git workflow

`main` holds the stable, working state; `develop` is the integration branch. Each implementation (ingestion, CDC, warehouse, transformation, orchestration, CI/CD, observability) was built on its own branch and merged into `develop` via a merge commit; `develop` is merged into `main` at verified milestones.
