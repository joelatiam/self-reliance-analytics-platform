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


def _postgres_connection():
    return psycopg2.connect(
        host=os.environ["POSTGRES_HOST"],
        port=os.environ.get("POSTGRES_PORT", "5432"),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        connect_timeout=5,
    )


def _postgres_row_counts(tables: list[str]) -> dict[str, int]:
    """Row count per table; a table that does not exist yet reports nothing."""
    counts: dict[str, int] = {}
    conn = _postgres_connection()
    try:
        for table in tables:
            with conn.cursor() as cur:
                try:
                    cur.execute(f"SELECT count(*) FROM {table}")
                    counts[table] = cur.fetchone()[0]
                except psycopg2.Error:
                    conn.rollback()
    finally:
        conn.close()
    return counts


def _postgres_watermark_ages(resources: list[str]) -> dict[str, float]:
    """Seconds since each resource's ingestion watermark last advanced."""
    ages: dict[str, float] = {}
    conn = _postgres_connection()
    try:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    "SELECT resource, extract(epoch from now() - updated_at) "
                    "FROM ingestion_watermarks WHERE resource = ANY(%s)",
                    (resources,),
                )
                ages = {row[0]: float(row[1]) for row in cur.fetchall()}
            except psycopg2.Error:
                conn.rollback()
    finally:
        conn.close()
    return ages


def _clickhouse_query(query: str) -> str:
    url = f"http://{os.environ['CLICKHOUSE_HOST']}:{os.environ['CLICKHOUSE_HTTP_PORT']}/"
    response = requests.get(
        url,
        params={"query": query},
        auth=(os.environ["CLICKHOUSE_USER"], os.environ["CLICKHOUSE_PASSWORD"]),
        timeout=5,
    )
    response.raise_for_status()
    return response.text.strip()


def _clickhouse_table_stats(tables: list[str]) -> dict[str, tuple[int, int]]:
    """(row_count, max_ts_ms) per raw table."""
    stats: dict[str, tuple[int, int]] = {}
    for table in tables:
        try:
            raw = _clickhouse_query(
                f"SELECT count(), max(ts_ms) FROM worldbank.raw_{table} FINAL FORMAT TSV"
            )
            count_str, max_ts_str = raw.split("\t")
            stats[table] = (int(count_str), int(max_ts_str or 0))
        except (requests.RequestException, ValueError):
            continue
    return stats


class PipelineCollector:
    def collect(self):
        healthy = 1

        # A scrape must never raise: an unreachable dependency should surface as
        # wb_pipeline_scrape_success 0, not as a dead exporter.
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
            "wb_pipeline_postgres_observations_total",
            "Row count in the Postgres observations table (OLTP source of truth)",
            value=pg_observations or 0,
        )
        yield GaugeMetricFamily(
            "wb_pipeline_clickhouse_observations_total",
            "Row count in the ClickHouse raw_observations table (CDC-landed)",
            value=ch_observations or 0,
        )

        lag_rows = (
            (pg_observations - ch_observations)
            if (pg_observations is not None and ch_observations is not None)
            else 0
        )
        yield GaugeMetricFamily(
            "wb_pipeline_cdc_lag_rows",
            "Postgres row count minus ClickHouse row count: CDC backlog proxy",
            value=lag_rows,
        )

        lag_seconds = (
            max(time.time() - (ch_observations_max_ts / 1000.0), 0)
            if ch_observations_max_ts
            else 0
        )
        yield GaugeMetricFamily(
            "wb_pipeline_cdc_lag_seconds",
            "Seconds since the most recent CDC event landed in ClickHouse",
            value=lag_seconds,
        )

        # Per-table breakdown, so a single stalled topic is visible instead of
        # being hidden behind a healthy aggregate.
        pg_rows = GaugeMetricFamily(
            "wb_pipeline_postgres_rows_total",
            "Row count per replicated Postgres table",
            labels=["table"],
        )
        ch_rows = GaugeMetricFamily(
            "wb_pipeline_clickhouse_rows_total",
            "Row count per CDC-landed ClickHouse raw table",
            labels=["table"],
        )
        table_lag_rows = GaugeMetricFamily(
            "wb_pipeline_cdc_lag_rows_by_table",
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
            "wb_pipeline_ingestion_watermark_age_seconds",
            "Seconds since each clients API resource last advanced its watermark",
            labels=["resource"],
        )
        for resource, age in watermark_ages.items():
            watermark_age.add_metric([resource], age)
        yield watermark_age

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
