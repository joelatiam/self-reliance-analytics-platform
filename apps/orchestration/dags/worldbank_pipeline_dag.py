"""Orchestrates: ingestion (World Bank + UNHCR) -> wait for CDC sync -> dbt build."""
from __future__ import annotations

import os
import sys
import time

import psycopg2
import requests
from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator
from airflow.utils.dates import days_ago

sys.path.insert(0, "/opt/airflow/ingestion/src")

CDC_SYNC_MAX_ATTEMPTS = 10
CDC_SYNC_POLL_SECONDS = 6
SYNCED_TABLES = ["observations", "refugee_statistics"]


def run_worldbank_ingestion() -> None:
    import main as ingestion_main

    ingestion_main.run_worldbank()


def run_refugee_ingestion() -> None:
    import main as ingestion_main

    ingestion_main.run_refugee_stats()


def _postgres_row_count(table: str) -> int:
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


def _clickhouse_row_count(table: str) -> int:
    url = f"http://{os.environ['CLICKHOUSE_HOST']}:{os.environ['CLICKHOUSE_HTTP_PORT']}/"
    response = requests.get(
        url,
        params={"query": f"SELECT count() FROM worldbank.raw_{table} FINAL"},
        auth=(os.environ["CLICKHOUSE_USER"], os.environ["CLICKHOUSE_PASSWORD"]),
        timeout=10,
    )
    response.raise_for_status()
    return int(response.text.strip())


def wait_for_cdc_sync() -> None:
    """Poll until ClickHouse has caught up with Postgres, or give up and proceed.

    Debezium replication is near-real-time but async; this avoids running dbt
    against a warehouse that hasn't fully caught up with the latest ingest.
    """
    targets = {table: _postgres_row_count(table) for table in SYNCED_TABLES}
    for attempt in range(1, CDC_SYNC_MAX_ATTEMPTS + 1):
        current = {table: _clickhouse_row_count(table) for table in SYNCED_TABLES}
        print(f"[cdc-sync] attempt {attempt}: clickhouse={current} postgres={targets}")
        if all(current[t] >= targets[t] for t in SYNCED_TABLES):
            return
        time.sleep(CDC_SYNC_POLL_SECONDS)
    print("[cdc-sync] gave up waiting for full sync, proceeding with dbt build anyway")


with DAG(
    dag_id="worldbank_indicators_pipeline",
    description="Ingest World Bank + UNHCR data, sync via CDC, transform in dbt",
    schedule_interval="0 */6 * * *",
    start_date=days_ago(1),
    catchup=False,
    tags=["worldbank", "unhcr", "ingestion", "cdc", "dbt"],
) as dag:
    ingest_worldbank = PythonOperator(
        task_id="ingest_worldbank_api", python_callable=run_worldbank_ingestion
    )

    ingest_refugee = PythonOperator(
        task_id="ingest_refugee_stats", python_callable=run_refugee_ingestion
    )

    wait_cdc = PythonOperator(task_id="wait_for_cdc_sync", python_callable=wait_for_cdc_sync)

    dbt_build = BashOperator(
        task_id="dbt_build",
        bash_command=(
            "/opt/dbt-venv/bin/dbt build "
            "--project-dir /opt/airflow/dbt --profiles-dir /opt/airflow/dbt"
        ),
    )

    [ingest_worldbank, ingest_refugee] >> wait_cdc >> dbt_build
