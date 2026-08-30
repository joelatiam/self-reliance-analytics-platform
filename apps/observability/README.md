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
| `wb_pipeline_postgres_observations_total` | Row count in Postgres `observations` |
| `wb_pipeline_clickhouse_observations_total` | Deduplicated row count in ClickHouse `raw_observations` |
| `wb_pipeline_cdc_lag_rows` | Postgres count minus ClickHouse count — replication backlog proxy |
| `wb_pipeline_cdc_lag_seconds` | Seconds since the most recent CDC event landed |
| `wb_pipeline_scrape_success` | 1 if both Postgres and ClickHouse answered this scrape, else 0 |

Full rationale in [`docs/design_report.md`](../../docs/design_report.md#4-observability-design).

## Access

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (`admin` / `admin`, see `.env`) — "World Bank Pipeline Overview" dashboard is auto-provisioned
- Raw exporter output: http://localhost:9105/metrics
