"""Guards for incremental pulls that are not safe to run for a past interval.

The clients API serves current state only: a row updated twelve times has one
updated_at, and there is no as-of query or change log. So a DAG run for an
interval that has already passed cannot reconstruct that interval — the rows
that changed then have since been overwritten.

The watermark makes this worse, not better: it is keyed on resource name alone,
so a backfilled run reads "everything since the mark" (which is now), finds
nothing, and reports success. That silent no-op is the failure mode these
guards exist to turn into a visible skip.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

# How far behind the current interval may fall before a run is treated as a
# replay of the past. Two intervals of slack absorbs a slow run or a retry
# without tripping.
STALE_RUN_LAG_SECONDS = 20 * 60


def is_stale_run(
    data_interval_end: datetime | None,
    now: datetime | None = None,
    max_lag_seconds: int = STALE_RUN_LAG_SECONDS,
) -> bool:
    """True when this run's interval ended long enough ago to be a replay."""
    if data_interval_end is None:
        return False

    now = now or datetime.now(timezone.utc)

    # A naive timestamp is assumed to be UTC, which is what Airflow hands over.
    if data_interval_end.tzinfo is None:
        data_interval_end = data_interval_end.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    return now - data_interval_end > timedelta(seconds=max_lag_seconds)


def describe_stale_run(data_interval_end: datetime, now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    if data_interval_end.tzinfo is None:
        data_interval_end = data_interval_end.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    behind = now - data_interval_end
    return (
        f"Interval ended {behind} ago. The clients API serves current state only, "
        "so this interval cannot be reconstructed; skipping rather than reporting "
        "a successful run that fetched nothing."
    )
