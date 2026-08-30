"""Orchestrates operational client activity: pull -> wait for CDC -> dbt build.

Runs every ten minutes, on the boundary. The source system generates its
activity five minutes into each window (:05, :15, :25, ...), so every run reads
data that settled five minutes earlier and never races a half-written batch.

The pull itself is incremental — each resource resumes from its own stored
watermark — so a ten-minute cadence carries only what actually changed rather
than re-reading the whole caseload.
"""
from __future__ import annotations

import sys

from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator
from airflow.utils.dates import days_ago
from cdc_sync import wait_for_cdc_sync

sys.path.insert(0, "/opt/airflow/ingestion/src")

SYNCED_TABLES = [
    "clients",
    "businesses",
    "loans",
    "loan_repayments",
    "advisory_sessions",
    "business_monthly_metrics",
]

# Ancestors are included with the leading '+' so the run is self-sufficient:
# it builds the World Bank and UNHCR models it joins against rather than
# assuming the six-hourly DAG got there first.
DBT_SELECTORS = (
    "+mart_country_program_context "
    "+mart_loan_performance "
    "+mart_repayment_performance "
    "+mart_business_growth"
)


def run_client_activity_ingestion() -> None:
    import main as ingestion_main

    ingestion_main.run_client_activity()


def wait_for_client_activity_cdc_sync() -> None:
    wait_for_cdc_sync(SYNCED_TABLES)


with DAG(
    dag_id="client_activity_pipeline",
    description="Pull client activity from the clients API, sync via CDC, transform in dbt",
    schedule_interval="*/10 * * * *",
    start_date=days_ago(1),
    catchup=False,
    max_active_runs=1,
    tags=["clients", "ingestion", "cdc", "dbt"],
) as dag:
    ingest_client_activity = PythonOperator(
        task_id="ingest_client_activity",
        python_callable=run_client_activity_ingestion,
    )

    wait_cdc = PythonOperator(
        task_id="wait_for_cdc_sync",
        python_callable=wait_for_client_activity_cdc_sync,
    )

    dbt_build = BashOperator(
        task_id="dbt_build_client_models",
        bash_command=(
            "/opt/dbt-venv/bin/dbt build "
            "--project-dir /opt/airflow/dbt --profiles-dir /opt/airflow/dbt "
            f"--select {DBT_SELECTORS}"
        ),
    )

    ingest_client_activity >> wait_cdc >> dbt_build
