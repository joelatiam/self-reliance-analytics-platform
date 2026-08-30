"""Thin client for the UNHCR Refugee Population Statistics API."""
from __future__ import annotations

import logging
import time

import requests

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.unhcr.org/population/v1/population"
DEFAULT_TIMEOUT = 15
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 2
PAGE_LIMIT = 100


class UnhcrClient:
    def __init__(self, base_url: str = DEFAULT_BASE_URL):
        self.base_url = base_url.rstrip("/")

    def fetch_asylum_country_stats(
        self,
        country_iso3_codes: list[str],
        year_from: int,
        year_to: int,
    ) -> list[dict]:
        """One row per (country of asylum, year), aggregated across all origins."""
        results: list[dict] = []
        for iso3 in country_iso3_codes:
            results.extend(self._fetch_all_pages(iso3, year_from, year_to))
        return results

    def _fetch_all_pages(self, coa_iso3: str, year_from: int, year_to: int) -> list[dict]:
        page = 1
        results: list[dict] = []
        while True:
            payload = self._get_json(
                {
                    "coa": coa_iso3,
                    "yearFrom": year_from,
                    "yearTo": year_to,
                    "limit": PAGE_LIMIT,
                    "page": page,
                }
            )
            items = payload.get("items", [])
            results.extend(items)
            if page >= payload.get("maxPages", 1) or not items:
                break
            page += 1
        return results

    def _get_json(self, params: dict) -> dict:
        last_error: Exception | None = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = requests.get(self.base_url + "/", params=params, timeout=DEFAULT_TIMEOUT)
                response.raise_for_status()
                return response.json()
            except (requests.RequestException, ValueError) as exc:
                last_error = exc
                logger.warning("UNHCR API request failed (attempt %s/%s): %s", attempt, MAX_RETRIES, exc)
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_BACKOFF_SECONDS * attempt)
        raise RuntimeError(f"UNHCR API request failed after {MAX_RETRIES} attempts") from last_error
