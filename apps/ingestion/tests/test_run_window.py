"""Unit tests for the stale-run guard."""
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from run_window import (
    STALE_RUN_LAG_SECONDS,
    describe_stale_run,
    is_stale_run,
)

NOW = datetime(2026, 8, 30, 12, 0, 0, tzinfo=timezone.utc)


def test_current_interval_is_not_stale():
    # The scheduled run for 11:50-12:00, executing at 12:00.
    assert is_stale_run(NOW, now=NOW) is False


def test_slightly_late_run_is_not_stale():
    # A slow or retried run still belongs to the present.
    assert is_stale_run(NOW - timedelta(minutes=15), now=NOW) is False


def test_backfilled_interval_is_stale():
    assert is_stale_run(NOW - timedelta(hours=6), now=NOW) is True
    assert is_stale_run(NOW - timedelta(days=3), now=NOW) is True


def test_boundary_is_exclusive():
    at_limit = NOW - timedelta(seconds=STALE_RUN_LAG_SECONDS)
    assert is_stale_run(at_limit, now=NOW) is False
    assert is_stale_run(at_limit - timedelta(seconds=1), now=NOW) is True


def test_naive_timestamps_are_treated_as_utc():
    naive = (NOW - timedelta(hours=6)).replace(tzinfo=None)
    assert is_stale_run(naive, now=NOW) is True


def test_missing_interval_never_blocks_a_manual_run():
    # A manually triggered run without an interval should still do its work.
    assert is_stale_run(None, now=NOW) is False


def test_description_says_why_it_skipped():
    message = describe_stale_run(NOW - timedelta(hours=6), now=NOW)
    assert "6:00:00 ago" in message
    assert "current state only" in message
