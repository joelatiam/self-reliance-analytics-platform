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
