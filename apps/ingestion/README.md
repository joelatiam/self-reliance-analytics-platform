# ingestion

Pulls data from three REST APIs into Postgres (the OLTP layer Debezium replicates from).

- [World Bank Open Data API](https://api.worldbank.org/v2) — country metadata, indicator metadata, yearly observations
- [UNHCR Refugee Population Statistics API](https://api.unhcr.org/population/v1/population/) — yearly displacement stats per host country
- [Clients API](../clients-api/README.md) — operational client activity (clients, businesses, loans, repayments, advisory sessions, monthly business metrics). **Generated data**, served by a source system in this repo; see the root README's data-sources section.

The first two are yearly country aggregates and get re-read in full each run — they are small and change at most annually. The third is row-level and changes continuously, so it is pulled **incrementally**: each resource has its own watermark in `ingestion_watermarks`, the client asks the API for everything with `updated_at` greater than it, and the watermark advances to the newest row actually stored. An empty run leaves the mark untouched, so a crash mid-page resumes rather than skipping, and the mark only ever moves forward so an out-of-order run cannot rewind it.

Because that mark is global rather than per-interval, and the clients API serves current state only, **this pull cannot be backfilled** — a past interval has no history left to reconstruct. The DAG skips a run whose interval has already passed instead of reporting success on an empty fetch. The design report's limitations section covers what would make it backfillable.

## Layout

```
src/
  worldbank_client.py     World Bank API client (pagination + retry)
  unhcr_client.py         UNHCR API client (pagination + retry)
  clients_api_client.py   Clients API client (paged, incremental, retry)
  transform.py            Pure parsing functions: raw API JSON -> row dicts
  db.py                   Postgres connection + upsert helpers, watermark read/write
  main.py                 Entry points: run_worldbank(), run_refugee_stats(),
                          run_client_activity(), run()
sql/
  001_schema.sql          countries, indicators, observations
  002_refugee_statistics.sql
  003_client_activity.sql clients, businesses, loans, repayments, advisory,
                          monthly metrics, ingestion_watermarks
tests/
  test_transform.py       Unit tests for the parsing functions
```

## Adding a column to a client-activity resource

The upsert is generated from the parsed row itself, so adding a field means
touching the parser in `transform.py` and the table in `003_client_activity.sql`
— `db.py` needs no change. Adding a whole resource means one entry in
`RESOURCE_PATHS`, one parser in `CLIENT_ACTIVITY_PARSERS`, and its primary key
in `CLIENT_ACTIVITY_KEYS`; a test asserts those three stay in step.

## Env vars

See [`.env.example`](../../.env.example) at the repo root: `WORLD_BANK_*`, `UNHCR_*`, `CLIENTS_API_*`, `POSTGRES_*`.

`CLIENTS_API_BASE_URL` defaults to `http://localhost:4000/api/v1` in code so the module runs straight from a laptop; docker compose overrides it with the `clients-api` service name.

## Run standalone

```bash
pip install -r requirements.txt
export POSTGRES_HOST=localhost POSTGRES_PORT=5433 POSTGRES_DB=worldbank POSTGRES_USER=wb_app POSTGRES_PASSWORD=wb_app_pw
python src/main.py
```

## Test

```bash
pip install -r requirements.txt pytest
pytest tests -v
```

In the running pipeline, Airflow invokes `run_worldbank()` and `run_refugee_stats()` as parallel tasks on a six-hourly DAG, and `run_client_activity()` on its own ten-minute DAG — see [`apps/orchestration`](../orchestration/README.md).
