"""Shared CDC catch-up check used by both pipeline DAGs.

Debezium replication is near-real-time but asynchronous, so a dbt build kicked
off the instant an ingest finishes can read a warehouse that has not caught up
yet. This polls until ClickHouse matches Postgres, then gives up and proceeds
rather than failing the run — a slightly stale build beats a red DAG.
"""
from __future__ import annotations

import os
import time

import psycopg2
import requests
from warehouse_schema import ensure_warehouse_schema

CDC_SYNC_MAX_ATTEMPTS = 10
CDC_SYNC_POLL_SECONDS = 6

# Must match the database the warehouse init SQL creates
# (apps/warehouse/init/01_kafka_sources.sql) and dbt writes into.
CLICKHOUSE_DB = os.environ.get("CLICKHOUSE_DB", "worldbank")


def postgres_row_count(table: str) -> int:
    conn = psycopg2.connect(
        host=os.environ["POSTGRES_HOST"],
        port=os.environ.get("POSTGRES_PORT", "5432"),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
    )
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT count(*) FROM {table}")
            return cur.fetchone()[0]
    finally:
        conn.close()


def clickhouse_row_count(table: str) -> int:
    url = f"http://{os.environ['CLICKHOUSE_HOST']}:{os.environ['CLICKHOUSE_HTTP_PORT']}/"
    response = requests.get(
        url,
        params={"query": f"SELECT count() FROM {CLICKHOUSE_DB}.raw_{table} FINAL"},
        auth=(os.environ["CLICKHOUSE_USER"], os.environ["CLICKHOUSE_PASSWORD"]),
        timeout=10,
    )
    response.raise_for_status()
    return int(response.text.strip())


def wait_for_cdc_sync(
    tables: list[str],
    max_attempts: int = CDC_SYNC_MAX_ATTEMPTS,
    poll_seconds: int = CDC_SYNC_POLL_SECONDS,
) -> None:
    """Poll until ClickHouse has caught up with Postgres, or proceed anyway."""
    # The tables counted below may post-date the ClickHouse volume; creating
    # them here is what keeps a 404 from failing the run.
    ensure_warehouse_schema()

    targets = {table: postgres_row_count(table) for table in tables}
    for attempt in range(1, max_attempts + 1):
        current = {table: clickhouse_row_count(table) for table in tables}
        print(f"[cdc-sync] attempt {attempt}: clickhouse={current} postgres={targets}")
        if all(current[table] >= targets[table] for table in tables):
            return
        if attempt < max_attempts:
            time.sleep(poll_seconds)
    print("[cdc-sync] gave up waiting for full sync, proceeding with dbt build anyway")
