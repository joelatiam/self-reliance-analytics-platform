"""Pure parsing functions: raw World Bank API JSON -> normalized row dicts.

Kept dependency-free (no network, no DB) so they're cheap to unit test.
"""
from __future__ import annotations

from typing import Any


def parse_country(raw: dict[str, Any]) -> dict[str, Any]:
    region = raw.get("region") or {}
    income_level = raw.get("incomeLevel") or {}
    return {
        "iso2_code": raw["iso2Code"],
        "iso3_code": raw.get("id"),
        "name": raw["name"],
        "region": region.get("value"),
        "income_level": income_level.get("value"),
        "capital_city": raw.get("capitalCity") or None,
        "longitude": _to_float(raw.get("longitude")),
        "latitude": _to_float(raw.get("latitude")),
    }


def parse_indicator(raw: dict[str, Any]) -> dict[str, Any]:
    source = raw.get("source") or {}
    return {
        "code": raw["id"],
        "name": raw["name"],
        "source_note": raw.get("sourceNote"),
        "source_organization": raw.get("sourceOrganization") or source.get("value"),
    }


def parse_observation(raw: dict[str, Any]) -> dict[str, Any] | None:
    country = raw.get("country") or {}
    indicator = raw.get("indicator") or {}
    country_code = country.get("id")
    indicator_code = indicator.get("id")
    year = raw.get("date")

    if not country_code or not indicator_code or year is None:
        return None

    return {
        "country_code": country_code,
        "indicator_code": indicator_code,
        "year": int(year),
        "value": _to_float(raw.get("value")),
        "unit": raw.get("unit") or None,
        "obs_status": raw.get("obs_status") or None,
        "decimal_places": raw.get("decimal"),
    }


def _to_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    return float(value)
