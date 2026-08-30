"""Custom Prometheus exporter for pipeline health: row counts, CDC lag, freshness.

Pull-based collector: every scrape queries Postgres and ClickHouse live,
rather than caching on a timer, so metrics never lag behind reality.
"""
from __future__ import annotations

import time

import app_health
import psycopg2
import requests
from datasources import (
    _clickhouse_table_stats,
    _postgres_row_counts,
    _postgres_watermark_ages,
)
from prometheus_client import start_http_server
from prometheus_client.core import REGISTRY, GaugeMetricFamily

EXPORTER_PORT = 9105

# Every table replicated through CDC, so a stalled topic shows up per table
# rather than being averaged away in a single number.
REPLICATED_TABLES = [
    "observations",
    "refugee_statistics",
    "clients",
    "businesses",
    "loans",
    "loan_repayments",
    "advisory_sessions",
    "business_monthly_metrics",
]

# Resources pulled incrementally from the clients API. Their watermark age is
# the fastest signal that the ten-minute pull has stopped making progress.
WATERMARK_RESOURCES = [
    "clients",
    "businesses",
    "loans",
    "loan_repayments",
    "advisory_sessions",
    "business_monthly_metrics",
]


class PipelineCollector:
    def collect(self):
        healthy = 1

        # A scrape must never raise: an unreachable dependency should surface as
        # sr_pipeline_scrape_success 0, not as a dead exporter.
        try:
            pg_counts = _postgres_row_counts(REPLICATED_TABLES)
            watermark_ages = _postgres_watermark_ages(WATERMARK_RESOURCES)
        except (psycopg2.Error, OSError, KeyError):
            pg_counts, watermark_ages = {}, {}
            healthy = 0

        try:
            ch_stats = _clickhouse_table_stats(REPLICATED_TABLES)
        except (requests.RequestException, OSError, KeyError):
            ch_stats = {}
            healthy = 0

        # Headline observations metrics, kept under their original names so the
        # provisioned Grafana dashboard keeps working.
        pg_observations = pg_counts.get("observations")
        ch_observations, ch_observations_max_ts = ch_stats.get("observations", (None, 0))

        yield GaugeMetricFamily(
            "sr_pipeline_postgres_observations_total",
            "Row count in the Postgres observations table (OLTP source of truth)",
            value=pg_observations or 0,
        )
        yield GaugeMetricFamily(
            "sr_pipeline_clickhouse_observations_total",
            "Row count in the ClickHouse raw_observations table (CDC-landed)",
            value=ch_observations or 0,
        )

        # Both lag gauges are omitted rather than zeroed when the input is
        # unknown: a zero here reads as "perfectly caught up" on the dashboard,
        # which is the opposite of the truth while ClickHouse is unreachable.
        if pg_observations is not None and ch_observations is not None:
            yield GaugeMetricFamily(
                "sr_pipeline_cdc_lag_rows",
                "Postgres row count minus ClickHouse row count: CDC backlog proxy",
                value=pg_observations - ch_observations,
            )

        if ch_observations_max_ts:
            yield GaugeMetricFamily(
                "sr_pipeline_cdc_lag_seconds",
                "Seconds since the most recent CDC event landed in ClickHouse",
                value=max(time.time() - (ch_observations_max_ts / 1000.0), 0),
            )

        # Per-table breakdown, so a single stalled topic is visible instead of
        # being hidden behind a healthy aggregate.
        pg_rows = GaugeMetricFamily(
            "sr_pipeline_postgres_rows_total",
            "Row count per replicated Postgres table",
            labels=["table"],
        )
        ch_rows = GaugeMetricFamily(
            "sr_pipeline_clickhouse_rows_total",
            "Row count per CDC-landed ClickHouse raw table",
            labels=["table"],
        )
        table_lag_rows = GaugeMetricFamily(
            "sr_pipeline_cdc_lag_rows_by_table",
            "Postgres minus ClickHouse row count, per replicated table",
            labels=["table"],
        )

        for table in REPLICATED_TABLES:
            pg_count = pg_counts.get(table)
            ch_count = ch_stats.get(table, (None, 0))[0]

            if pg_count is not None:
                pg_rows.add_metric([table], pg_count)
            if ch_count is not None:
                ch_rows.add_metric([table], ch_count)
            if pg_count is not None and ch_count is not None:
                table_lag_rows.add_metric([table], pg_count - ch_count)

        yield pg_rows
        yield ch_rows
        yield table_lag_rows

        watermark_age = GaugeMetricFamily(
            "sr_pipeline_ingestion_watermark_age_seconds",
            "Seconds since each clients API resource last advanced its watermark",
            labels=["resource"],
        )
        for resource, age in watermark_ages.items():
            watermark_age.add_metric([resource], age)
        yield watermark_age

        # Liveness of every app in the stack, so Grafana covers the whole
        # platform rather than only the pipeline's data path.
        app_up = GaugeMetricFamily(
            "sr_pipeline_app_up",
            "1 if the app answered its health check this scrape, else 0",
            labels=["app", "kind"],
        )
        app_latency = GaugeMetricFamily(
            "sr_pipeline_app_response_seconds",
            "How long the app took to answer its health check",
            labels=["app", "kind"],
        )
        for probe, up, elapsed in app_health.collect():
            app_up.add_metric([probe.app, probe.kind], 1 if up else 0)
            app_latency.add_metric([probe.app, probe.kind], elapsed)
        yield app_up
        yield app_latency

        yield GaugeMetricFamily(
            "sr_pipeline_scrape_success",
            "1 if both Postgres and ClickHouse were reachable this scrape, else 0",
            value=healthy,
        )


if __name__ == "__main__":
    REGISTRY.register(PipelineCollector())
    start_http_server(EXPORTER_PORT)
    print(f"metrics-exporter listening on :{EXPORTER_PORT}/metrics")
    while True:
        time.sleep(3600)
