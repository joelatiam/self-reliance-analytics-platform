FROM apache/airflow:2.10.5-python3.11

USER root
RUN python3 -m venv /opt/dbt-venv && chown -R airflow:root /opt/dbt-venv
USER airflow

COPY apps/ingestion/requirements.txt /tmp/ingestion-requirements.txt
COPY apps/transformation/requirements.txt /tmp/dbt-requirements.txt

RUN pip install --no-cache-dir -r /tmp/ingestion-requirements.txt
RUN /opt/dbt-venv/bin/pip install --no-cache-dir -r /tmp/dbt-requirements.txt
