"""Custom Prometheus exporter for pipeline health: row counts, CDC lag, freshness.

Pull-based collector: every scrape queries Postgres and ClickHouse live,
rather than caching on a timer, so metrics never lag behind reality.
"""
from __future__ import annotations

import os
import time

import psycopg2
import requests
from prometheus_client import start_http_server
from prometheus_client.core import REGISTRY, GaugeMetricFamily

EXPORTER_PORT = 9105


def _postgres_observation_count() -> int:
    conn = psycopg2.connect(
        host=os.environ["POSTGRES_HOST"],
        port=os.environ.get("POSTGRES_PORT", "5432"),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        connect_timeout=5,
    )
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM observations")
            return cur.fetchone()[0]
    finally:
        conn.close()


def _clickhouse_observation_stats() -> tuple[int, int]:
    """Returns (row_count, max_ts_ms) from the CDC-landed observations table."""
    url = f"http://{os.environ['CLICKHOUSE_HOST']}:{os.environ['CLICKHOUSE_HTTP_PORT']}/"
    response = requests.get(
        url,
        params={"query": "SELECT count(), max(ts_ms) FROM worldbank.raw_observations FINAL FORMAT TSV"},
        auth=(os.environ["CLICKHOUSE_USER"], os.environ["CLICKHOUSE_PASSWORD"]),
        timeout=5,
    )
    response.raise_for_status()
    count_str, max_ts_str = response.text.strip().split("\t")
    return int(count_str), int(max_ts_str or 0)


class PipelineCollector:
    def collect(self):
        pg_count = ch_count = ch_max_ts_ms = None
        healthy = 1

        try:
            pg_count = _postgres_observation_count()
        except Exception:
            healthy = 0

        try:
            ch_count, ch_max_ts_ms = _clickhouse_observation_stats()
        except Exception:
            healthy = 0

        yield GaugeMetricFamily(
            "wb_pipeline_postgres_observations_total",
            "Row count in the Postgres observations table (OLTP source of truth)",
            value=pg_count or 0,
        )
        yield GaugeMetricFamily(
            "wb_pipeline_clickhouse_observations_total",
            "Row count in the ClickHouse raw_observations table (CDC-landed)",
            value=ch_count or 0,
        )

        lag_rows = (pg_count - ch_count) if (pg_count is not None and ch_count is not None) else 0
        yield GaugeMetricFamily(
            "wb_pipeline_cdc_lag_rows",
            "Postgres row count minus ClickHouse row count: CDC backlog proxy",
            value=lag_rows,
        )

        lag_seconds = max(time.time() - (ch_max_ts_ms / 1000.0), 0) if ch_max_ts_ms else 0
        yield GaugeMetricFamily(
            "wb_pipeline_cdc_lag_seconds",
            "Seconds since the most recent CDC event landed in ClickHouse",
            value=lag_seconds,
        )

        yield GaugeMetricFamily(
            "wb_pipeline_scrape_success",
            "1 if both Postgres and ClickHouse were reachable this scrape, else 0",
            value=healthy,
        )


if __name__ == "__main__":
    REGISTRY.register(PipelineCollector())
    start_http_server(EXPORTER_PORT)
    print(f"metrics-exporter listening on :{EXPORTER_PORT}/metrics")
    while True:
        time.sleep(3600)
