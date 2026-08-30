"""Thin client for the World Bank Open Data REST API."""
from __future__ import annotations

import logging
import time
from typing import Any

import requests

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.worldbank.org/v2"
DEFAULT_TIMEOUT = 15
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 2


def _get_json(url: str, params: dict[str, Any]) -> Any:
    params = {**params, "format": "json"}
    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(url, params=params, timeout=DEFAULT_TIMEOUT)
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError) as exc:
            last_error = exc
            logger.warning("World Bank API request failed (attempt %s/%s): %s", attempt, MAX_RETRIES, exc)
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_BACKOFF_SECONDS * attempt)
    raise RuntimeError(f"World Bank API request to {url} failed after {MAX_RETRIES} attempts") from last_error


def _paginate(url: str, params: dict[str, Any]) -> list[dict]:
    """The World Bank API returns [metadata, data] and paginates via metadata.pages."""
    page = 1
    per_page = params.get("per_page", 1000)
    results: list[dict] = []
    while True:
        payload = _get_json(url, {**params, "page": page, "per_page": per_page})
        if not isinstance(payload, list) or len(payload) < 2 or payload[1] is None:
            break
        metadata, data = payload[0], payload[1]
        results.extend(data)
        total_pages = metadata.get("pages", 1)
        if page >= total_pages:
            break
        page += 1
    return results


class WorldBankClient:
    def __init__(self, base_url: str = DEFAULT_BASE_URL):
        self.base_url = base_url.rstrip("/")

    def fetch_country_metadata(self, country_codes: list[str]) -> list[dict]:
        codes = ";".join(country_codes)
        url = f"{self.base_url}/country/{codes}"
        return _paginate(url, {})

    def fetch_indicator_metadata(self, indicator_codes: list[str]) -> list[dict]:
        results: list[dict] = []
        for code in indicator_codes:
            url = f"{self.base_url}/indicator/{code}"
            results.extend(_paginate(url, {}))
        return results

    def fetch_observations(
        self,
        country_codes: list[str],
        indicator_codes: list[str],
        date_range: str = "2000:2024",
    ) -> list[dict]:
        countries = ";".join(country_codes)
        results: list[dict] = []
        for indicator_code in indicator_codes:
            url = f"{self.base_url}/country/{countries}/indicator/{indicator_code}"
            results.extend(_paginate(url, {"date": date_range, "per_page": 1000}))
        return results
