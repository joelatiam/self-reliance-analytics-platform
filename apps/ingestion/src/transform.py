"""Pure parsing functions: raw source API JSON -> normalized row dicts.

Covers the World Bank and UNHCR aggregates and the row-level client activity
from the clients API. Kept dependency-free (no network, no DB) so they're cheap
to unit test.
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


def parse_refugee_stat(raw: dict[str, Any]) -> dict[str, Any] | None:
    country_iso3 = raw.get("coa_iso")
    year = raw.get("year")
    if not country_iso3 or country_iso3 == "-" or year is None:
        return None

    return {
        "country_iso3": country_iso3,
        "year": int(year),
        "refugees": _to_int(raw.get("refugees")),
        "asylum_seekers": _to_int(raw.get("asylum_seekers")),
        "returned_refugees": _to_int(raw.get("returned_refugees")),
        "idps": _to_int(raw.get("idps")),
        "returned_idps": _to_int(raw.get("returned_idps")),
        "stateless": _to_int(raw.get("stateless")),
        "others_of_concern": _to_int(raw.get("ooc")),
        "host_community": _to_int(raw.get("hst")),
    }


def _to_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


def _to_int(value: Any) -> int | None:
    if value is None or value == "" or value == "-":
        return None
    return int(value)


# --- Clients API (operational client activity) ---------------------------------
#
# The API returns camelCase and carries its own updated_at, which we keep as
# source_updated_at: it is the watermark the next incremental pull resumes from,
# and it must not be confused with this table's own updated_at.


def parse_client(raw: dict[str, Any]) -> dict[str, Any] | None:
    if not raw.get("clientCode"):
        return None

    return {
        "client_code": raw["clientCode"],
        "first_name": raw.get("firstName"),
        "last_name": raw.get("lastName"),
        "gender": raw.get("gender"),
        "birth_year": _to_int(raw.get("birthYear")),
        "is_youth": raw.get("isYouth"),
        "country_iso3": raw.get("countryIso3"),
        "country_iso2": raw.get("countryIso2"),
        "location_name": raw.get("locationName"),
        "region": raw.get("region"),
        "in_camp": raw.get("inCamp"),
        "displacement_status": raw.get("displacementStatus"),
        "origin_country_iso3": raw.get("originCountryIso3"),
        "arrival_year": _to_int(raw.get("arrivalYear")),
        "household_size": _to_int(raw.get("householdSize")),
        "dependents": _to_int(raw.get("dependents")),
        "education_level": raw.get("educationLevel"),
        "primary_language": raw.get("primaryLanguage"),
        "program_track": raw.get("programTrack"),
        "cohort": raw.get("cohort"),
        "enrolled_on": raw.get("enrolledOn"),
        "advisor_code": raw.get("advisorCode"),
        "status": raw.get("status"),
        "source_updated_at": raw.get("updatedAt"),
    }


def parse_business(raw: dict[str, Any]) -> dict[str, Any] | None:
    if not raw.get("businessCode"):
        return None

    return {
        "business_code": raw["businessCode"],
        "client_code": raw.get("clientCode"),
        "name": raw.get("name"),
        "sector": raw.get("sector"),
        "sub_sector": raw.get("subSector"),
        "stage": raw.get("stage"),
        "registration_status": raw.get("registrationStatus"),
        "market_access": raw.get("marketAccess"),
        "country_iso3": raw.get("countryIso3"),
        "location_name": raw.get("locationName"),
        "started_year": _to_int(raw.get("startedYear")),
        "employees_full_time": _to_int(raw.get("employeesFullTime")),
        "employees_part_time": _to_int(raw.get("employeesPartTime")),
        "employees_female": _to_int(raw.get("employeesFemale")),
        "employees_displaced": _to_int(raw.get("employeesDisplaced")),
        "currency": raw.get("currency"),
        "monthly_revenue_local": _to_float(raw.get("monthlyRevenueLocal")),
        "monthly_revenue_usd": _to_float(raw.get("monthlyRevenueUsd")),
        "monthly_profit_usd": _to_float(raw.get("monthlyProfitUsd")),
        "baseline_monthly_revenue_usd": _to_float(raw.get("baselineMonthlyRevenueUsd")),
        "status": raw.get("status"),
        "source_updated_at": raw.get("updatedAt"),
    }


def parse_loan(raw: dict[str, Any]) -> dict[str, Any] | None:
    if not raw.get("loanCode"):
        return None

    return {
        "loan_code": raw["loanCode"],
        "client_code": raw.get("clientCode"),
        "business_code": raw.get("businessCode"),
        "country_iso3": raw.get("countryIso3"),
        "loan_cycle": _to_int(raw.get("loanCycle")),
        "currency": raw.get("currency"),
        "principal_local": _to_float(raw.get("principalLocal")),
        "principal_usd": _to_float(raw.get("principalUsd")),
        "interest_rate_annual": _to_float(raw.get("interestRateAnnual")),
        "term_months": _to_int(raw.get("termMonths")),
        "purpose": raw.get("purpose"),
        "risk_grade": raw.get("riskGrade"),
        "applied_on": raw.get("appliedOn"),
        "disbursed_on": raw.get("disbursedOn"),
        "maturity_on": raw.get("maturityOn"),
        "installments_total": _to_int(raw.get("installmentsTotal")),
        "installments_paid": _to_int(raw.get("installmentsPaid")),
        "total_repayable_usd": _to_float(raw.get("totalRepayableUsd")),
        "amount_repaid_usd": _to_float(raw.get("amountRepaidUsd")),
        "outstanding_usd": _to_float(raw.get("outstandingUsd")),
        "days_past_due": _to_int(raw.get("daysPastDue")),
        "status": raw.get("status"),
        "source_updated_at": raw.get("updatedAt"),
    }


def parse_loan_repayment(raw: dict[str, Any]) -> dict[str, Any] | None:
    if not raw.get("repaymentCode"):
        return None

    return {
        "repayment_code": raw["repaymentCode"],
        "loan_code": raw.get("loanCode"),
        "client_code": raw.get("clientCode"),
        "country_iso3": raw.get("countryIso3"),
        "installment_number": _to_int(raw.get("installmentNumber")),
        "currency": raw.get("currency"),
        "amount_local": _to_float(raw.get("amountLocal")),
        "amount_usd": _to_float(raw.get("amountUsd")),
        "due_on": raw.get("dueOn"),
        "paid_at": raw.get("paidAt"),
        "days_late": _to_int(raw.get("daysLate")),
        "on_time": raw.get("onTime"),
        "method": raw.get("method"),
        "source_updated_at": raw.get("updatedAt"),
    }


def parse_advisory_session(raw: dict[str, Any]) -> dict[str, Any] | None:
    if not raw.get("sessionCode"):
        return None

    return {
        "session_code": raw["sessionCode"],
        "client_code": raw.get("clientCode"),
        "business_code": raw.get("businessCode"),
        "country_iso3": raw.get("countryIso3"),
        "advisor_code": raw.get("advisorCode"),
        "session_type": raw.get("sessionType"),
        "topic": raw.get("topic"),
        "language": raw.get("language"),
        "delivered_at": raw.get("deliveredAt"),
        "duration_minutes": _to_int(raw.get("durationMinutes")),
        "attended": raw.get("attended"),
        "satisfaction_score": _to_int(raw.get("satisfactionScore")),
        "source_updated_at": raw.get("updatedAt"),
    }


def parse_business_metric(raw: dict[str, Any]) -> dict[str, Any] | None:
    if not raw.get("businessCode") or not raw.get("period"):
        return None

    return {
        "business_code": raw["businessCode"],
        "period": raw["period"],
        "client_code": raw.get("clientCode"),
        "country_iso3": raw.get("countryIso3"),
        "currency": raw.get("currency"),
        "revenue_local": _to_float(raw.get("revenueLocal")),
        "revenue_usd": _to_float(raw.get("revenueUsd")),
        "profit_usd": _to_float(raw.get("profitUsd")),
        "employees_total": _to_int(raw.get("employeesTotal")),
        "customers_served": _to_int(raw.get("customersServed")),
        "revenue_growth_pct": _to_float(raw.get("revenueGrowthPct")),
        "source_updated_at": raw.get("updatedAt"),
    }


# Resource name -> parser, so the ingestion loop stays a single generic pass.
CLIENT_ACTIVITY_PARSERS = {
    "clients": parse_client,
    "businesses": parse_business,
    "loans": parse_loan,
    "loan_repayments": parse_loan_repayment,
    "advisory_sessions": parse_advisory_session,
    "business_monthly_metrics": parse_business_metric,
}
