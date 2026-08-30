"""Entry point: fetch World Bank reference + observation data into Postgres.

Env vars:
  WORLD_BANK_BASE_URL   default https://api.worldbank.org/v2
  WORLD_BANK_COUNTRIES  comma-separated ISO2 codes, e.g. RW,KE,ET,SS,TD
  WORLD_BANK_INDICATORS comma-separated indicator codes
  WORLD_BANK_DATE_RANGE default 2000:2024
"""
from __future__ import annotations

import logging
import os
import sys

from db import get_connection, upsert_countries, upsert_indicators, upsert_observations
from transform import parse_country, parse_indicator, parse_observation
from worldbank_client import WorldBankClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ingestion")


def run() -> None:
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
        "Ingestion complete: %s countries, %s indicators, %s observations",
        n_countries,
        n_indicators,
        n_observations,
    )


if __name__ == "__main__":
    try:
        run()
    except Exception:
        logger.exception("Ingestion failed")
        sys.exit(1)
