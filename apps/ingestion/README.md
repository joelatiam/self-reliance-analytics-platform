# ingestion

Pulls data from two public REST APIs into Postgres (the OLTP layer Debezium replicates from).

- [World Bank Open Data API](https://api.worldbank.org/v2) — country metadata, indicator metadata, yearly observations
- [UNHCR Refugee Population Statistics API](https://api.unhcr.org/population/v1/population/) — yearly displacement stats per host country

## Layout

```
src/
  worldbank_client.py   World Bank API client (pagination + retry)
  unhcr_client.py        UNHCR API client (pagination + retry)
  transform.py            Pure parsing functions: raw API JSON -> row dicts
  db.py                   Postgres connection + upsert helpers
  main.py                 Entry points: run_worldbank(), run_refugee_stats(), run()
sql/
  001_schema.sql          countries, indicators, observations
  002_refugee_statistics.sql
tests/
  test_transform.py       Unit tests for the parsing functions
```

## Env vars

See [`.env.example`](../../.env.example) at the repo root: `WORLD_BANK_*`, `UNHCR_*`, `POSTGRES_*`.

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

In the running pipeline, Airflow invokes `run_worldbank()` and `run_refugee_stats()` directly as separate tasks — see [`apps/orchestration`](../orchestration/README.md).
