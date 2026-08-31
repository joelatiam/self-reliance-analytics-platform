import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from transform import (  # noqa: E402
    parse_country,
    parse_indicator,
    parse_observation,
    parse_refugee_stat,
)


def test_parse_country_maps_expected_fields():
    raw = {
        "id": "RWA",
        "iso2Code": "RW",
        "name": "Rwanda",
        "region": {"id": "AFE", "value": "Sub-Saharan Africa (excluding high income)"},
        "incomeLevel": {"id": "LIC", "value": "Low income"},
        "capitalCity": "Kigali",
        "longitude": "30.0619",
        "latitude": "-1.9441",
    }
    result = parse_country(raw)
    assert result["iso2_code"] == "RW"
    assert result["iso3_code"] == "RWA"
    assert result["name"] == "Rwanda"
    assert result["region"] == "Sub-Saharan Africa (excluding high income)"
    assert result["income_level"] == "Low income"
    assert result["longitude"] == 30.0619
    assert result["latitude"] == -1.9441


def test_parse_indicator_maps_expected_fields():
    raw = {
        "id": "NY.GDP.MKTP.KD.ZG",
        "name": "GDP growth (annual %)",
        "sourceNote": "Annual percentage growth rate of GDP.",
        "sourceOrganization": "World Bank national accounts data.",
    }
    result = parse_indicator(raw)
    assert result["code"] == "NY.GDP.MKTP.KD.ZG"
    assert result["name"] == "GDP growth (annual %)"
    assert result["source_note"] == "Annual percentage growth rate of GDP."


def test_parse_observation_maps_expected_fields():
    raw = {
        "indicator": {"id": "NY.GDP.MKTP.KD.ZG", "value": "GDP growth (annual %)"},
        "country": {"id": "RW", "value": "Rwanda"},
        "countryiso3code": "RWA",
        "date": "2023",
        "value": 8.2,
        "unit": "",
        "obs_status": "",
        "decimal": 1,
    }
    result = parse_observation(raw)
    assert result == {
        "country_code": "RW",
        "indicator_code": "NY.GDP.MKTP.KD.ZG",
        "year": 2023,
        "value": 8.2,
        "unit": None,
        "obs_status": None,
        "decimal_places": 1,
    }


def test_parse_observation_returns_none_when_value_missing_fields():
    raw = {"indicator": {}, "country": {}, "date": None, "value": None}
    assert parse_observation(raw) is None


def test_parse_refugee_stat_maps_expected_fields():
    raw = {
        "year": 2023,
        "coa_iso": "RWA",
        "coa_name": "Rwanda",
        "refugees": 115643,
        "asylum_seekers": 12660,
        "returned_refugees": 325,
        "idps": "0",
        "returned_idps": "-",
        "stateless": 9500,
        "ooc": 7060,
        "hst": 12139,
    }
    result = parse_refugee_stat(raw)
    assert result == {
        "country_iso3": "RWA",
        "year": 2023,
        "refugees": 115643,
        "asylum_seekers": 12660,
        "returned_refugees": 325,
        "idps": 0,
        "returned_idps": None,
        "stateless": 9500,
        "others_of_concern": 7060,
        "host_community": 12139,
    }


def test_parse_refugee_stat_returns_none_without_asylum_country():
    raw = {"year": 2023, "coa_iso": "-", "refugees": 100}
    assert parse_refugee_stat(raw) is None


def test_parse_observation_handles_null_value():
    raw = {
        "indicator": {"id": "NY.GDP.MKTP.KD.ZG"},
        "country": {"id": "SS"},
        "date": "2024",
        "value": None,
    }
    result = parse_observation(raw)
    assert result is not None
    assert result["value"] is None
