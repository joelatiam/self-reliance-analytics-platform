"""Reads the two datastores the pipeline moves data between.

Split out of app.py so the collector there stays about *what* is measured and
this stays about *how* it is fetched.
"""
from __future__ import annotations

import os

import psycopg2
import requests

# Must match the database the warehouse init SQL creates
# (apps/warehouse/init/01_kafka_sources.sql) and dbt writes into.
CLICKHOUSE_DB = os.environ.get("CLICKHOUSE_DB", "self_reliance")


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
    """(row_count, max_ts_ms) per raw table.

    A table that does not exist yet is skipped, but an unreachable server is
    raised: swallowing both alike would let sr_pipeline_scrape_success report a
    healthy pipeline while ClickHouse is down.
    """
    stats: dict[str, tuple[int, int]] = {}
    for table in tables:
        try:
            raw = _clickhouse_query(
                f"SELECT count(), max(ts_ms) FROM {CLICKHOUSE_DB}.raw_{table} FINAL FORMAT TSV"
            )
            count_str, max_ts_str = raw.split("\t")
            stats[table] = (int(count_str), int(max_ts_str or 0))
        except (requests.HTTPError, ValueError):
            continue
    return stats
