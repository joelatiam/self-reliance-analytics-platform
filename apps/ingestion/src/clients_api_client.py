"""Client for the clients API — the program's simulated operational system.

Reads are incremental: each resource is paged in `updated_at` order and the
caller passes back the highest timestamp it has already stored, so a run only
carries rows that actually changed.
"""
from __future__ import annotations

import logging
import time
from collections.abc import Iterator
from typing import Any

import requests

logger = logging.getLogger(__name__)

# Localhost so the module works when run straight from a laptop; docker compose
# overrides it with the clients-api service name.
DEFAULT_BASE_URL = "http://localhost:4000/api/v1"
DEFAULT_TIMEOUT = 30
DEFAULT_PAGE_SIZE = 500
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 2

# Resource name -> API path. The name is also the watermark key and the
# Postgres table, so the three never drift apart.
RESOURCE_PATHS = {
    "clients": "/clients",
    "businesses": "/businesses",
    "loans": "/loans",
    "loan_repayments": "/loan-repayments",
    "advisory_sessions": "/advisory-sessions",
    "business_monthly_metrics": "/business-metrics",
}


class ClientsApiClient:
    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        api_key: str | None = None,
        page_size: int = DEFAULT_PAGE_SIZE,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key or None
        self.page_size = page_size

    def fetch_resource(
        self,
        resource: str,
        updated_since: str | None = None,
    ) -> Iterator[list[dict[str, Any]]]:
        """Yield pages of rows for one resource, oldest change first.

        Walks by keyset cursor rather than by page number. The source is being
        written to while we read it, and under OFFSET paging a row updated
        mid-walk moves to the end of the updated_at ordering and shifts an
        unread row back into a page already consumed. That row is then never
        collected, because the watermark advances past its timestamp. Following
        meta.nextCursor pins each page to the last row's sort key instead, so
        concurrent writes cannot move rows out of the walk.
        """
        path = RESOURCE_PATHS.get(resource)
        if path is None:
            raise ValueError(f"Unknown clients API resource: {resource}")

        cursor: str | None = None
        while True:
            params: dict[str, Any] = {"limit": self.page_size}
            if updated_since:
                params["updatedSince"] = updated_since
            if cursor:
                params["cursor"] = cursor

            payload = self._get_json(path, params)
            rows = payload.get("data", [])
            meta = payload.get("meta", {})

            if rows:
                yield rows

            cursor = meta.get("nextCursor")
            if not rows or not cursor:
                break

    def fetch_summary(self, country: str | None = None) -> dict[str, Any]:
        """Portfolio rollup, used to sanity-check what was replicated."""
        params = {"country": country} if country else {}
        return self._get_json("/summary", params)

    def _get_json(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers = {"x-api-key": self.api_key} if self.api_key else {}

        last_error: Exception | None = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = requests.get(
                    url, params=params, headers=headers, timeout=DEFAULT_TIMEOUT
                )
                response.raise_for_status()
                return response.json()
            except (requests.RequestException, ValueError) as exc:
                last_error = exc
                logger.warning(
                    "Clients API request failed (attempt %s/%s): %s",
                    attempt,
                    MAX_RETRIES,
                    exc,
                )
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_BACKOFF_SECONDS * attempt)

        raise RuntimeError(
            f"Clients API request to {url} failed after {MAX_RETRIES} attempts"
        ) from last_error
