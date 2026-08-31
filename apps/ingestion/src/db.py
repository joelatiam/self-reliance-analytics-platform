"""Postgres connection + upsert helpers for the ingestion layer."""
from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import psycopg2
import psycopg2.extras


@contextmanager
def get_connection() -> Iterator[psycopg2.extensions.connection]:
    conn = psycopg2.connect(
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=os.environ.get("POSTGRES_PORT", "5432"),
        dbname=os.environ.get("POSTGRES_DB", "worldbank"),
        user=os.environ.get("POSTGRES_USER", "wb_app"),
        password=os.environ.get("POSTGRES_PASSWORD", "wb_app_pw"),
    )
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def upsert_countries(conn, countries: list[dict[str, Any]]) -> int:
    if not countries:
        return 0
    sql = """
        INSERT INTO countries (iso2_code, iso3_code, name, region, income_level, capital_city, longitude, latitude, updated_at)
        VALUES (%(iso2_code)s, %(iso3_code)s, %(name)s, %(region)s, %(income_level)s, %(capital_city)s, %(longitude)s, %(latitude)s, now())
        ON CONFLICT (iso2_code) DO UPDATE SET
            iso3_code = EXCLUDED.iso3_code,
            name = EXCLUDED.name,
            region = EXCLUDED.region,
            income_level = EXCLUDED.income_level,
            capital_city = EXCLUDED.capital_city,
            longitude = EXCLUDED.longitude,
            latitude = EXCLUDED.latitude,
            updated_at = now();
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, sql, countries)
    return len(countries)


def upsert_indicators(conn, indicators: list[dict[str, Any]]) -> int:
    if not indicators:
        return 0
    sql = """
        INSERT INTO indicators (code, name, source_note, source_organization, updated_at)
        VALUES (%(code)s, %(name)s, %(source_note)s, %(source_organization)s, now())
        ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            source_note = EXCLUDED.source_note,
            source_organization = EXCLUDED.source_organization,
            updated_at = now();
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, sql, indicators)
    return len(indicators)


def upsert_refugee_statistics(conn, stats: list[dict[str, Any]]) -> int:
    if not stats:
        return 0
    sql = """
        INSERT INTO refugee_statistics
            (country_iso3, year, refugees, asylum_seekers, returned_refugees,
             idps, returned_idps, stateless, others_of_concern, host_community, updated_at)
        VALUES
            (%(country_iso3)s, %(year)s, %(refugees)s, %(asylum_seekers)s, %(returned_refugees)s,
             %(idps)s, %(returned_idps)s, %(stateless)s, %(others_of_concern)s, %(host_community)s, now())
        ON CONFLICT (country_iso3, year) DO UPDATE SET
            refugees = EXCLUDED.refugees,
            asylum_seekers = EXCLUDED.asylum_seekers,
            returned_refugees = EXCLUDED.returned_refugees,
            idps = EXCLUDED.idps,
            returned_idps = EXCLUDED.returned_idps,
            stateless = EXCLUDED.stateless,
            others_of_concern = EXCLUDED.others_of_concern,
            host_community = EXCLUDED.host_community,
            updated_at = now();
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, sql, stats)
    return len(stats)


def upsert_observations(conn, observations: list[dict[str, Any]]) -> int:
    if not observations:
        return 0
    sql = """
        INSERT INTO observations (country_code, indicator_code, year, value, unit, obs_status, decimal_places, updated_at)
        VALUES (%(country_code)s, %(indicator_code)s, %(year)s, %(value)s, %(unit)s, %(obs_status)s, %(decimal_places)s, now())
        ON CONFLICT (country_code, indicator_code, year) DO UPDATE SET
            value = EXCLUDED.value,
            unit = EXCLUDED.unit,
            obs_status = EXCLUDED.obs_status,
            decimal_places = EXCLUDED.decimal_places,
            updated_at = now();
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, sql, observations)
    return len(observations)


# --- Clients API (operational client activity) ---------------------------------

# Primary key per resource. Everything else about the upsert is derived from the
# parsed row itself, so adding a column to a parser needs no change here.
CLIENT_ACTIVITY_KEYS = {
    "clients": ["client_code"],
    "businesses": ["business_code"],
    "loans": ["loan_code"],
    "loan_repayments": ["repayment_code"],
    "advisory_sessions": ["session_code"],
    "business_monthly_metrics": ["business_code", "period"],
}


def upsert_client_activity(conn, resource: str, rows: list[dict[str, Any]]) -> int:
    """Upsert a page of rows for one clients API resource."""
    if not rows:
        return 0

    key_columns = CLIENT_ACTIVITY_KEYS.get(resource)
    if key_columns is None:
        raise ValueError(f"Unknown clients API resource: {resource}")

    columns = list(rows[0].keys())
    placeholders = ", ".join(f"%({column})s" for column in columns)
    updatable = [column for column in columns if column not in key_columns]
    assignments = ", ".join(f"{column} = EXCLUDED.{column}" for column in updatable)

    sql = f"""
        INSERT INTO {resource} ({", ".join(columns)}, updated_at)
        VALUES ({placeholders}, now())
        ON CONFLICT ({", ".join(key_columns)}) DO UPDATE SET
            {assignments},
            updated_at = now();
    """

    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, sql, rows)
    return len(rows)


def get_watermark(conn, resource: str) -> str | None:
    """Highest source updated_at already ingested for this resource."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT watermark FROM ingestion_watermarks WHERE resource = %s",
            (resource,),
        )
        row = cur.fetchone()

    if not row or row[0] is None:
        return None
    return row[0].isoformat()


def set_watermark(conn, resource: str, watermark: str, rows_ingested: int) -> None:
    """Advance the mark so the next run resumes from exactly here.

    Only ever moves forward, so ordering between runs cannot corrupt it.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ingestion_watermarks (resource, watermark, rows_ingested, updated_at)
            VALUES (%s, %s, %s, now())
            ON CONFLICT (resource) DO UPDATE SET
                -- GREATEST, not assignment: a run that finishes out of order
                -- must never rewind the mark and make the next run re-read.
                watermark = GREATEST(ingestion_watermarks.watermark, EXCLUDED.watermark),
                rows_ingested = ingestion_watermarks.rows_ingested + EXCLUDED.rows_ingested,
                updated_at = now();
            """,
            (resource, watermark, rows_ingested),
        )
