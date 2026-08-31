"""Entry points: fetch World Bank + UNHCR data into Postgres.

Env vars:
  WORLD_BANK_BASE_URL   default https://api.worldbank.org/v2
  WORLD_BANK_COUNTRIES  comma-separated ISO2 codes, e.g. RW,KE,ET,SS,TD
  WORLD_BANK_INDICATORS comma-separated indicator codes
  WORLD_BANK_DATE_RANGE default 2000:2024
  UNHCR_BASE_URL        default https://api.unhcr.org/population/v1/population
  UNHCR_COUNTRIES       comma-separated ISO3 codes, e.g. RWA,KEN,ETH,SSD,TCD
  UNHCR_YEAR_FROM       default 2015
  UNHCR_YEAR_TO         default 2023
  CLIENTS_API_BASE_URL  default http://localhost:4000/api/v1 (compose sets the
                        clients-api service name)
  CLIENTS_API_KEY       optional; sent as x-api-key when set
  CLIENTS_API_PAGE_SIZE default 500
"""
from __future__ import annotations

import logging
import os
import sys

from clients_api_client import DEFAULT_BASE_URL, RESOURCE_PATHS, ClientsApiClient
from db import (
    get_connection,
    get_watermark,
    set_watermark,
    upsert_client_activity,
    upsert_countries,
    upsert_indicators,
    upsert_observations,
    upsert_refugee_statistics,
)
from schema import ensure_schema
from transform import (
    CLIENT_ACTIVITY_PARSERS,
    parse_country,
    parse_indicator,
    parse_observation,
    parse_refugee_stat,
)
from unhcr_client import UnhcrClient
from worldbank_client import WorldBankClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ingestion")


def run_worldbank() -> None:
    ensure_schema()
    base_url = os.environ.get("WORLD_BANK_BASE_URL", "https://api.worldbank.org/v2")
    countries = os.environ.get("WORLD_BANK_COUNTRIES", "RW,KE,ET,SS,TD").split(",")
    indicators = os.environ.get("WORLD_BANK_INDICATORS", "NY.GDP.MKTP.KD.ZG").split(",")
    date_range = os.environ.get("WORLD_BANK_DATE_RANGE", "2000:2024")

    client = WorldBankClient(base_url=base_url)

    logger.info("Fetching country metadata for %s", countries)
    country_rows = [parse_country(c) for c in client.fetch_country_metadata(countries)]

    logger.info("Fetching indicator metadata for %s", indicators)
    indicator_rows = [parse_indicator(i) for i in client.fetch_indicator_metadata(indicators)]

    logger.info("Fetching observations (date range %s)", date_range)
    raw_observations = client.fetch_observations(countries, indicators, date_range=date_range)
    observation_rows = [row for raw in raw_observations if (row := parse_observation(raw)) is not None]

    with get_connection() as conn:
        n_countries = upsert_countries(conn, country_rows)
        n_indicators = upsert_indicators(conn, indicator_rows)
        n_observations = upsert_observations(conn, observation_rows)

    logger.info(
        "World Bank ingestion complete: %s countries, %s indicators, %s observations",
        n_countries,
        n_indicators,
        n_observations,
    )


def run_refugee_stats() -> None:
    ensure_schema()
    base_url = os.environ.get("UNHCR_BASE_URL", "https://api.unhcr.org/population/v1/population")
    countries = os.environ.get("UNHCR_COUNTRIES", "RWA,KEN,ETH,SSD,TCD").split(",")
    year_from = int(os.environ.get("UNHCR_YEAR_FROM", "2015"))
    year_to = int(os.environ.get("UNHCR_YEAR_TO", "2023"))

    client = UnhcrClient(base_url=base_url)

    logger.info("Fetching UNHCR displacement stats for %s (%s-%s)", countries, year_from, year_to)
    raw_stats = client.fetch_asylum_country_stats(countries, year_from, year_to)
    stat_rows = [row for raw in raw_stats if (row := parse_refugee_stat(raw)) is not None]

    with get_connection() as conn:
        n_stats = upsert_refugee_statistics(conn, stat_rows)

    logger.info("UNHCR ingestion complete: %s country-year rows", n_stats)


def run_client_activity() -> None:
    """Pull every clients API resource incrementally, one watermark each.

    Runs on a much tighter schedule than the yearly aggregates: the source
    generates activity every ten minutes, so this pulls only what changed since
    the previous run rather than re-reading the whole caseload.
    """
    ensure_schema()

    base_url = os.environ.get("CLIENTS_API_BASE_URL", DEFAULT_BASE_URL)
    api_key = os.environ.get("CLIENTS_API_KEY") or None
    page_size = int(os.environ.get("CLIENTS_API_PAGE_SIZE", "500"))

    client = ClientsApiClient(base_url=base_url, api_key=api_key, page_size=page_size)
    totals: dict[str, int] = {}

    with get_connection() as conn:
        for resource in RESOURCE_PATHS:
            parser = CLIENT_ACTIVITY_PARSERS[resource]
            watermark = get_watermark(conn, resource)
            logger.info(
                "Fetching %s from clients API (since %s)", resource, watermark or "the beginning"
            )

            ingested = 0
            newest = watermark

            for page in client.fetch_resource(resource, updated_since=watermark):
                rows = [row for raw in page if (row := parser(raw)) is not None]
                ingested += upsert_client_activity(conn, resource, rows)

                page_newest = max(
                    (row["source_updated_at"] for row in rows if row["source_updated_at"]),
                    default=None,
                )
                if page_newest and (newest is None or page_newest > newest):
                    newest = page_newest

            # Only advance the mark when something moved; an empty run leaves it
            # exactly where it was so nothing can be skipped.
            if ingested and newest:
                set_watermark(conn, resource, newest, ingested)

            totals[resource] = ingested

    logger.info(
        "Clients API ingestion complete: %s",
        ", ".join(f"{resource}={count}" for resource, count in totals.items()),
    )


def run() -> None:
    run_worldbank()
    run_refugee_stats()
    run_client_activity()


if __name__ == "__main__":
    try:
        run()
    except Exception:
        logger.exception("Ingestion failed")
        sys.exit(1)
