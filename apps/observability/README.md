# observability

Platform observability: is the pipeline healthy, is data fresh, is CDC keeping up?

## Layout

```
metrics_exporter/    Custom Prometheus exporter (Python)
                     Pull-based: every scrape queries Postgres + ClickHouse live.
prometheus/
  prometheus.yml      Scrape config: the exporter + ClickHouse's native /metrics
grafana/
  provisioning/        Datasource + dashboard auto-provisioning (as code)
  dashboards/          pipeline_overview.json
```

## Metrics exposed (`metrics_exporter`)

| Metric | Meaning |
|---|---|
| `sr_pipeline_postgres_observations_total` | Row count in Postgres `observations` |
| `sr_pipeline_clickhouse_observations_total` | Deduplicated row count in ClickHouse `raw_observations` |
| `sr_pipeline_cdc_lag_rows` | Postgres count minus ClickHouse count — replication backlog proxy |
| `sr_pipeline_cdc_lag_seconds` | Seconds since the most recent CDC event landed |
| `sr_pipeline_scrape_success` | 1 if both Postgres and ClickHouse answered this scrape, else 0 |

Full rationale in [`docs/design_report.md`](../../docs/design_report.md#4-observability-design).

## Access

- Prometheus: http://localhost:9090

## What is monitored

Every app in the stack, not just the data path. The custom exporter probes each
one's health endpoint on every scrape and publishes `sr_pipeline_app_up` and
`sr_pipeline_app_response_seconds`, labelled by app and kind:

| kind | apps |
|---|---|
| `database` | postgres, clients-api-db |
| `warehouse` | clickhouse |
| `broker` / `cdc` | kafka, kafka-connect |
| `orchestration` | airflow |
| `source-system` | clients-api |
| `observability` | prometheus, grafana |
| `bi` | metabase |

This is deliberately a probe rather than a fleet of per-technology exporters. A
Postgres exporter, a Kafka JMX exporter and a StatsD bridge for Airflow would be
several more containers and a few hundred MB in a 4 GB VM, to answer a question
this answers directly. The pipeline's own health -- replication completeness and
freshness -- is measured properly in `app.py`.

**The BI layer is opt-in.** Metabase sits behind the `bi` profile, so when it has
not been started nothing is listening and the probe publishes *no* series for it
rather than a permanent zero -- "not deployed" is not an outage. Start it with
`docker compose --profile bi up -d metabase` and it appears on the dashboard on
the next scrape. Note it wants ~1.5 GB, so on a 4 GB VM it does not fit
alongside the full pipeline; stop what you are not using.

- Grafana: http://localhost:3000 (`admin` / `admin`, see `.env`) — "Pipeline Overview" dashboard is auto-provisioned
- Raw exporter output: http://localhost:9105/metrics
