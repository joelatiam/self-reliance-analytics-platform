"""Applies the ClickHouse warehouse schema before the CDC wait reads from it.

The mirror of ingestion's schema bootstrap. ClickHouse, like Postgres, only runs
/docker-entrypoint-initdb.d against an *empty* data directory, so tables added
after a volume was created never appear in it: the client-activity raw tables
were missing from a warehouse that otherwise looked healthy, and the DAG failed
with a bare 404 on `worldbank.raw_clients`.

Every statement in warehouse/init is CREATE ... IF NOT EXISTS, so re-applying is
a no-op that costs a few hundred milliseconds.
"""
from __future__ import annotations

import logging
import os
import re
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

# Mounted read-only by the airflow services; see docker-compose.yml.
SQL_DIR = Path(os.environ.get("WAREHOUSE_SQL_DIR", "/opt/airflow/warehouse"))

# Seeded data is for CI only; it must never run against a real warehouse.
SKIP_FILES = {"ci_seed_data.sql"}

_applied = False


def schema_files() -> list[Path]:
    """The warehouse DDL files, in the numeric order their names impose."""
    return [p for p in sorted(SQL_DIR.glob("*.sql")) if p.name not in SKIP_FILES]


def _statements(sql: str) -> list[str]:
    without_comments = re.sub(r"--[^\n]*", "", sql)
    return [s.strip() for s in without_comments.split(";") if s.strip()]


def _execute(statement: str) -> None:
    response = requests.post(
        f"http://{os.environ['CLICKHOUSE_HOST']}:{os.environ['CLICKHOUSE_HTTP_PORT']}/",
        data=statement.encode("utf-8"),
        auth=(os.environ["CLICKHOUSE_USER"], os.environ["CLICKHOUSE_PASSWORD"]),
        timeout=30,
    )
    response.raise_for_status()


def ensure_warehouse_schema(force: bool = False) -> None:
    """Apply every warehouse DDL file. Runs once per process unless forced."""
    global _applied
    if _applied and not force:
        return

    files = schema_files()
    if not files:
        raise RuntimeError(f"No warehouse SQL found in {SQL_DIR}")

    for path in files:
        statements = _statements(path.read_text())
        for statement in statements:
            _execute(statement)
        logger.info("Applied warehouse file %s (%s statements)", path.name, len(statements))

    _applied = True
