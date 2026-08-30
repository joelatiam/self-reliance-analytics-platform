"""Orchestrates: World Bank ingestion -> wait for CDC sync -> dbt build."""
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


def run_ingestion() -> None:
    import main as ingestion_main

    ingestion_main.run()


def _postgres_observation_count() -> int:
    conn = psycopg2.connect(
        host=os.environ["POSTGRES_HOST"],
        port=os.environ.get("POSTGRES_PORT", "5432"),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
    )
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM observations")
            return cur.fetchone()[0]
    finally:
        conn.close()


def _clickhouse_observation_count() -> int:
    url = f"http://{os.environ['CLICKHOUSE_HOST']}:{os.environ['CLICKHOUSE_HTTP_PORT']}/"
    response = requests.get(
        url,
        params={"query": "SELECT count() FROM worldbank.raw_observations"},
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
    target = _postgres_observation_count()
    for attempt in range(1, CDC_SYNC_MAX_ATTEMPTS + 1):
        current = _clickhouse_observation_count()
        print(f"[cdc-sync] attempt {attempt}: clickhouse={current} postgres={target}")
        if current >= target:
            return
        time.sleep(CDC_SYNC_POLL_SECONDS)
    print("[cdc-sync] gave up waiting for full sync, proceeding with dbt build anyway")


with DAG(
    dag_id="worldbank_indicators_pipeline",
    description="Ingest World Bank data, sync via CDC, transform in dbt",
    schedule_interval="0 */6 * * *",
    start_date=days_ago(1),
    catchup=False,
    tags=["worldbank", "ingestion", "cdc", "dbt"],
) as dag:
    ingest = PythonOperator(task_id="ingest_worldbank_api", python_callable=run_ingestion)

    wait_cdc = PythonOperator(task_id="wait_for_cdc_sync", python_callable=wait_for_cdc_sync)

    dbt_build = BashOperator(
        task_id="dbt_build",
        bash_command=(
            "/opt/dbt-venv/bin/dbt build "
            "--project-dir /opt/airflow/dbt --profiles-dir /opt/airflow/dbt"
        ),
    )

    ingest >> wait_cdc >> dbt_build
