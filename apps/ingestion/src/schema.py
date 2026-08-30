"""Applies the Postgres schema before any ingestion run.

Postgres only executes /docker-entrypoint-initdb.d against an *empty* data
directory, so a table added to sql/ after someone's volume was created never
reaches it, and the run fails with "relation ... does not exist". Every
statement in those files is idempotent (CREATE ... IF NOT EXISTS, and
REPLICA IDENTITY DEFAULT, which is a no-op when already set), so applying them
at startup costs a few milliseconds and removes the whole class of failure.
"""
from __future__ import annotations

import logging
from pathlib import Path

from db import get_connection

logger = logging.getLogger(__name__)

# src/ and sql/ are siblings, in the repo and in the Airflow container alike
# (./apps/ingestion is mounted whole at /opt/airflow/ingestion).
SQL_DIR = Path(__file__).resolve().parent.parent / "sql"

_applied = False


def schema_files() -> list[Path]:
    """The migration files, in the numeric order their names impose."""
    return sorted(SQL_DIR.glob("*.sql"))


def ensure_schema(force: bool = False) -> None:
    """Apply every schema file. Runs once per process unless forced."""
    global _applied
    if _applied and not force:
        return

    files = schema_files()
    if not files:
        raise RuntimeError(f"No schema files found in {SQL_DIR}")

    with get_connection() as conn:
        for path in files:
            with conn.cursor() as cur:
                cur.execute(path.read_text())
            logger.info("Applied schema file %s", path.name)

    _applied = True
