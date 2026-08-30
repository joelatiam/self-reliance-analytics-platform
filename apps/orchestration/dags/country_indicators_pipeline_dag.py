"""Orchestrates: ingestion (World Bank + UNHCR) -> wait for CDC sync -> dbt build.

Runs six-hourly, which is as often as these yearly country aggregates can
possibly change. Operational client activity moves far faster and has its own
DAG (client_activity_dag) on a ten-minute schedule.
"""
from __future__ import annotations

import sys

from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator
from airflow.utils.dates import days_ago
from cdc_sync import wait_for_cdc_sync

sys.path.insert(0, "/opt/airflow/ingestion/src")

SYNCED_TABLES = ["observations", "refugee_statistics"]


def run_worldbank_ingestion() -> None:
    import main as ingestion_main

    ingestion_main.run_worldbank()


def run_refugee_ingestion() -> None:
    import main as ingestion_main

    ingestion_main.run_refugee_stats()


def wait_for_worldbank_cdc_sync() -> None:
    wait_for_cdc_sync(SYNCED_TABLES)


with DAG(
    dag_id="country_indicators_pipeline",
    description="Ingest World Bank + UNHCR country-level indicators, sync via CDC, transform in dbt",
    schedule_interval="0 */6 * * *",
    start_date=days_ago(1),
    catchup=False,
    tags=["country-indicators", "worldbank", "unhcr", "ingestion", "cdc", "dbt"],
) as dag:
    ingest_worldbank = PythonOperator(
        task_id="ingest_worldbank_api", python_callable=run_worldbank_ingestion
    )

    ingest_refugee = PythonOperator(
        task_id="ingest_refugee_stats", python_callable=run_refugee_ingestion
    )

    wait_cdc = PythonOperator(
        task_id="wait_for_cdc_sync", python_callable=wait_for_worldbank_cdc_sync
    )

    dbt_build = BashOperator(
        task_id="dbt_build",
        bash_command=(
            "/opt/dbt-venv/bin/dbt build "
            "--project-dir /opt/airflow/dbt --profiles-dir /opt/airflow/dbt"
        ),
    )

    [ingest_worldbank, ingest_refugee] >> wait_cdc >> dbt_build
