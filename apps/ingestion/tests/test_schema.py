"""The schema bootstrap runs before every ingestion task, so a broken path or a
lost ordering breaks the whole pipeline. Both are checked without a database."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

SRC = Path(__file__).resolve().parent.parent / "src"
sys.path.insert(0, str(SRC))

import schema


def test_schema_files_are_found_and_numerically_ordered():
    names = [path.name for path in schema.schema_files()]

    assert names, "no schema files discovered; SQL_DIR is probably wrong"
    assert names == sorted(names)
    assert names[0].startswith("001_")


def test_sql_dir_sits_next_to_src():
    assert schema.SQL_DIR.is_dir()
    assert schema.SQL_DIR.name == "sql"


def test_every_statement_is_idempotent():
    """Re-running against a live volume must not fail on existing objects."""
    for path in schema.schema_files():
        for statement in path.read_text().split(";"):
            head = statement.strip().upper()
            if head.startswith(("CREATE TABLE", "CREATE INDEX")):
                assert "IF NOT EXISTS" in head, f"{path.name}: {head[:60]}"


@patch("schema.get_connection")
def test_ensure_schema_applies_every_file_once(mock_get_connection):
    connection = MagicMock()
    mock_get_connection.return_value.__enter__.return_value = connection
    schema._applied = False

    schema.ensure_schema()
    executed = connection.cursor.return_value.__enter__.return_value.execute
    assert executed.call_count == len(schema.schema_files())

    # Memoised: a second call in the same process is a no-op.
    schema.ensure_schema()
    assert executed.call_count == len(schema.schema_files())

    schema.ensure_schema(force=True)
    assert executed.call_count == 2 * len(schema.schema_files())


@patch("schema.get_connection")
def test_ensure_schema_raises_when_no_files_found(mock_get_connection, tmp_path):
    schema._applied = False
    with patch.object(schema, "SQL_DIR", tmp_path), pytest.raises(RuntimeError):
        schema.ensure_schema()
