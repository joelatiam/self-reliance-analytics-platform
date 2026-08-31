"""Liveness probes for every app in the stack, including the opt-in BI layer.

Deliberately not a fleet of per-technology exporters. A Postgres exporter, a
Kafka JMX exporter, a StatsD bridge for Airflow and so on would be four more
containers and several hundred MB in a 4 GB VM, to answer a question this
already answers: is each app up, and how fast does it say so. Anything deeper
about the pipeline's health is measured directly in app.py.

Probes are cheap and independent: one app being unreachable never hides
another, and a probe never raises into the scrape.
"""
from __future__ import annotations

import os
import socket
import time
from dataclasses import dataclass

import requests

PROBE_TIMEOUT = 3


@dataclass(frozen=True)
class Probe:
    app: str
    kind: str
    # Exactly one of url / address is set.
    url: str | None = None
    address: tuple[str, int] | None = None
    # Optional apps are not part of the default stack: when nothing is
    # listening they report no metric at all rather than a permanent 0, so a
    # profile that was never started does not look like an outage.
    optional: bool = False


def _host(env_var: str, default: str) -> str:
    return os.environ.get(env_var, default)


def probes() -> list[Probe]:
    ch_host = _host("CLICKHOUSE_HOST", "clickhouse")
    ch_port = os.environ.get("CLICKHOUSE_HTTP_PORT", "8123")
    pg_host = _host("POSTGRES_HOST", "postgres")
    pg_port = int(os.environ.get("POSTGRES_PORT", "5432"))

    return [
        Probe("postgres", "database", address=(pg_host, pg_port)),
        Probe("clickhouse", "warehouse", url=f"http://{ch_host}:{ch_port}/ping"),
        Probe("kafka", "broker", address=(_host("KAFKA_HOST", "kafka"), 9092)),
        Probe(
            "kafka-connect",
            "cdc",
            url=f"http://{_host('KAFKA_CONNECT_HOST', 'kafka-connect')}:8083/connectors",
        ),
        Probe(
            "airflow",
            "orchestration",
            url=f"http://{_host('AIRFLOW_HOST', 'airflow-webserver')}:8080/health",
        ),
        Probe(
            "prometheus",
            "observability",
            url=f"http://{_host('PROMETHEUS_HOST', 'prometheus')}:9090/-/healthy",
        ),
        Probe(
            "grafana",
            "observability",
            url=f"http://{_host('GRAFANA_HOST', 'grafana')}:3000/api/health",
        ),
        Probe(
            "clients-api",
            "source-system",
            url=f"http://{_host('CLIENTS_API_HOST', 'clients-api')}:4000/health",
        ),
        Probe(
            "clients-api-db",
            "database",
            address=(_host("CLIENTS_API_DB_HOST", "clients-api-db"), 5432),
        ),
        Probe(
            "metabase",
            "bi",
            url=f"http://{_host('METABASE_HOST', 'metabase')}:3000/api/health",
            optional=True,
        ),
    ]


def _check(probe: Probe) -> tuple[bool | None, float]:
    """(healthy, seconds). healthy is None when an optional app is absent."""
    started = time.monotonic()
    try:
        if probe.url:
            response = requests.get(probe.url, timeout=PROBE_TIMEOUT)
            healthy = response.status_code < 400
        else:
            with socket.create_connection(probe.address, timeout=PROBE_TIMEOUT):
                healthy = True
    except (requests.RequestException, OSError):
        # Nothing listening at all: for an opt-in profile that means "not
        # deployed", which is not the same as "down".
        return (None if probe.optional else False), time.monotonic() - started

    return healthy, time.monotonic() - started


def collect() -> list[tuple[Probe, bool, float]]:
    """Probe every app. Absent optional apps are omitted."""
    results = []
    for probe in probes():
        healthy, elapsed = _check(probe)
        if healthy is None:
            continue
        results.append((probe, healthy, elapsed))
    return results
