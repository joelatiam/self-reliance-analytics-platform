"""The liveness probes decide what Grafana calls healthy, so the three states
they can report are pinned here: up, down, and not deployed."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))

import app_health


def test_every_app_in_the_stack_is_probed():
    apps = {p.app for p in app_health.probes()}

    assert apps == {
        "postgres",
        "clickhouse",
        "kafka",
        "kafka-connect",
        "airflow",
        "prometheus",
        "grafana",
        "clients-api",
        "clients-api-db",
        "metabase",
    }


def test_only_the_opt_in_bi_layer_is_optional():
    optional = {p.app for p in app_health.probes() if p.optional}

    assert optional == {"metabase"}


def test_each_probe_has_exactly_one_target():
    for probe in app_health.probes():
        assert bool(probe.url) != bool(probe.address), probe.app


def test_a_required_app_that_is_unreachable_reports_down():
    with patch.object(
        app_health.requests, "get", side_effect=requests.ConnectionError
    ), patch.object(app_health.socket, "create_connection", side_effect=OSError):
        results = {p.app: up for p, up, _ in app_health.collect()}

    assert results["postgres"] is False
    assert results["clickhouse"] is False


def test_an_absent_optional_app_is_omitted_rather_than_reported_down():
    """A profile that was never started is not an outage."""
    with patch.object(
        app_health.requests, "get", side_effect=requests.ConnectionError
    ), patch.object(app_health.socket, "create_connection", side_effect=OSError):
        apps = [p.app for p, _, _ in app_health.collect()]

    assert "metabase" not in apps
    assert "postgres" in apps


def test_an_http_error_status_counts_as_down():
    class Unhealthy:
        status_code = 503

    with patch.object(app_health.requests, "get", return_value=Unhealthy()):
        results = {p.app: up for p, up, _ in app_health.collect() if p.url}

    assert results["grafana"] is False
    assert results["clients-api"] is False


def test_a_healthy_app_reports_up_with_a_duration():
    class Healthy:
        status_code = 200

    with patch.object(app_health.requests, "get", return_value=Healthy()):
        results = [(p.app, up, secs) for p, up, secs in app_health.collect() if p.url]

    assert all(up for _, up, _ in results)
    assert all(secs >= 0 for _, _, secs in results)
