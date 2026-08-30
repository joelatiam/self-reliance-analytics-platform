import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from transform import (  # noqa: E402
    CLIENT_ACTIVITY_PARSERS,
    parse_business,
    parse_business_metric,
    parse_client,
    parse_country,
    parse_indicator,
    parse_loan,
    parse_loan_repayment,
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


# --- Clients API parsers -------------------------------------------------------


def test_parse_client_maps_camel_case_to_columns():
    raw = {
        "clientCode": "SR-C-KEN-000042",
        "firstName": "Amina",
        "lastName": "Warsame",
        "gender": "FEMALE",
        "birthYear": 1994,
        "isYouth": True,
        "countryIso3": "KEN",
        "countryIso2": "KE",
        "locationName": "Kalobeyei Settlement",
        "region": "Turkana",
        "inCamp": True,
        "displacementStatus": "REFUGEE",
        "originCountryIso3": "SOM",
        "arrivalYear": 2018,
        "householdSize": 7,
        "dependents": 5,
        "educationLevel": "PRIMARY",
        "primaryLanguage": "Somali",
        "programTrack": "FINANCING",
        "cohort": "2026-Q2",
        "enrolledOn": "2026-04-18",
        "advisorCode": "SR-ADV-KEN-004",
        "status": "ACTIVE",
        "updatedAt": "2026-08-30T10:25:00.412Z",
    }
    result = parse_client(raw)
    assert result is not None
    assert result["client_code"] == "SR-C-KEN-000042"
    assert result["displacement_status"] == "REFUGEE"
    assert result["origin_country_iso3"] == "SOM"
    assert result["in_camp"] is True
    assert result["source_updated_at"] == "2026-08-30T10:25:00.412Z"


def test_parse_client_keeps_null_origin_for_host_community():
    raw = {
        "clientCode": "SR-C-RWA-000007",
        "displacementStatus": "HOST_COMMUNITY",
        "originCountryIso3": None,
        "arrivalYear": None,
        "updatedAt": "2026-08-30T10:25:00.412Z",
    }
    result = parse_client(raw)
    assert result is not None
    assert result["origin_country_iso3"] is None
    assert result["arrival_year"] is None


def test_parse_client_returns_none_without_code():
    assert parse_client({"firstName": "Amina"}) is None


def test_parse_business_converts_money_strings_to_numbers():
    raw = {
        "businessCode": "SR-B-KEN-000042",
        "clientCode": "SR-C-KEN-000042",
        "name": "Amani General Supplies",
        "sector": "Retail & Trade",
        "countryIso3": "KEN",
        "currency": "KES",
        "monthlyRevenueLocal": "109650.00",
        "monthlyRevenueUsd": "850.00",
        "monthlyProfitUsd": "161.50",
        "baselineMonthlyRevenueUsd": "520.00",
        "employeesFullTime": 2,
        "employeesPartTime": 1,
        "updatedAt": "2026-08-30T10:25:00.480Z",
    }
    result = parse_business(raw)
    assert result is not None
    assert result["monthly_revenue_usd"] == 850.0
    assert result["baseline_monthly_revenue_usd"] == 520.0
    assert result["sector"] == "Retail & Trade"


def test_parse_loan_keeps_null_disbursement_for_pending_loans():
    raw = {
        "loanCode": "SR-L-RWA-000042",
        "clientCode": "SR-C-RWA-000042",
        "businessCode": "SR-B-RWA-000042",
        "countryIso3": "RWA",
        "principalUsd": "750.00",
        "outstandingUsd": "0.00",
        "disbursedOn": None,
        "maturityOn": None,
        "status": "PENDING",
        "daysPastDue": 0,
        "updatedAt": "2026-08-30T10:25:00.512Z",
    }
    result = parse_loan(raw)
    assert result is not None
    assert result["disbursed_on"] is None
    assert result["status"] == "PENDING"
    assert result["principal_usd"] == 750.0


def test_parse_loan_repayment_preserves_lateness():
    raw = {
        "repaymentCode": "SR-R-KEN-000118",
        "loanCode": "SR-L-KEN-000042",
        "clientCode": "SR-C-KEN-000042",
        "countryIso3": "KEN",
        "installmentNumber": 3,
        "amountUsd": "70.31",
        "dueOn": "2026-09-05",
        "paidAt": "2026-09-19T08:00:00.000Z",
        "daysLate": 14,
        "onTime": False,
        "method": "MOBILE_MONEY",
        "updatedAt": "2026-09-19T08:00:00.000Z",
    }
    result = parse_loan_repayment(raw)
    assert result is not None
    assert result["days_late"] == 14
    assert result["on_time"] is False


def test_parse_business_metric_requires_business_and_period():
    assert parse_business_metric({"businessCode": "SR-B-KEN-000042"}) is None
    assert parse_business_metric({"period": "2026-08"}) is None

    result = parse_business_metric(
        {
            "businessCode": "SR-B-KEN-000042",
            "period": "2026-08",
            "clientCode": "SR-C-KEN-000042",
            "countryIso3": "KEN",
            "revenueUsd": "850.00",
            "revenueGrowthPct": "63.46",
            "updatedAt": "2026-08-30T10:25:00.600Z",
        }
    )
    assert result is not None
    assert result["period"] == "2026-08"
    assert result["revenue_growth_pct"] == 63.46


def test_every_client_activity_resource_has_a_parser():
    from clients_api_client import RESOURCE_PATHS  # noqa: E402

    assert set(CLIENT_ACTIVITY_PARSERS) == set(RESOURCE_PATHS)


def test_client_activity_parsers_all_emit_the_watermark_column():
    # Every parsed row must carry source_updated_at, or the incremental pull
    # would silently stop advancing for that resource.
    samples = {
        "clients": {"clientCode": "SR-C-KEN-1", "updatedAt": "2026-08-30T10:00:00Z"},
        "businesses": {"businessCode": "SR-B-KEN-1", "updatedAt": "2026-08-30T10:00:00Z"},
        "loans": {"loanCode": "SR-L-KEN-1", "updatedAt": "2026-08-30T10:00:00Z"},
        "loan_repayments": {"repaymentCode": "SR-R-KEN-1", "updatedAt": "2026-08-30T10:00:00Z"},
        "advisory_sessions": {"sessionCode": "SR-A-KEN-1", "updatedAt": "2026-08-30T10:00:00Z"},
        "business_monthly_metrics": {
            "businessCode": "SR-B-KEN-1",
            "period": "2026-08",
            "updatedAt": "2026-08-30T10:00:00Z",
        },
    }

    for resource, parser in CLIENT_ACTIVITY_PARSERS.items():
        row = parser(samples[resource])
        assert row is not None, resource
        assert row["source_updated_at"] == "2026-08-30T10:00:00Z", resource
