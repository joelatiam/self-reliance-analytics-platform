# warehouse

ClickHouse (OLAP) schema: consumes Debezium's Kafka topics and lands them as queryable tables. This is the CDC-landed "raw" layer that dbt sources from.

## Layout

```
init/
  01_kafka_sources.sql        Kafka-engine tables (JSONAsString) per topic
  02_raw_tables.sql            ReplacingMergeTree(ts_ms) tables, one per source table
  03_materialized_views.sql    Parses the Debezium envelope, lands into the raw tables
  ci_seed_data.sql             Representative rows for CI (stands in for live CDC)
config/
  prometheus.xml               Enables ClickHouse's native Prometheus /metrics endpoint
```

Mounted into the `clickhouse` service's `/docker-entrypoint-initdb.d/` — runs automatically on first boot against a fresh volume.

## Design choices

See [`docs/design_report.md`](../../docs/design_report.md#3-data-model--schema) for the full rationale on table engine, ordering keys, and partitioning.

Quick summary: `JSONAsString` + `JSONExtract` in a materialized view (rather than declaring Debezium's full envelope schema) keeps this tolerant of minor envelope changes; `ReplacingMergeTree(ts_ms)` versions on Debezium's own event timestamp, so `SELECT ... FINAL` always gives the latest state per key.

`FINAL` matters much more for the client-activity tables than for the country aggregates. A loan row is re-replicated on every repayment, so the same `loan_code` lands many times; the staging models all select `final` to collapse it to current state.

## Check it

```bash
docker exec wb-clickhouse clickhouse-client -q "SELECT count() FROM worldbank.raw_observations FINAL"
```
