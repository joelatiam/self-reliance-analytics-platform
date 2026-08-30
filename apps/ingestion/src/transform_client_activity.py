"""Pure parsing functions: clients API JSON -> normalized row dicts.

The API returns camelCase and carries its own updated_at, which we keep as
source_updated_at: it is the watermark the next incremental pull resumes from,
and it must not be confused with the target table's own updated_at.

Kept dependency-free (no network, no DB) so they're cheap to unit test.
"""
from __future__ import annotations

from typing import Any

from transform_shared import to_float, to_int


def parse_client(raw: dict[str, Any]) -> dict[str, Any] | None:
    if not raw.get("clientCode"):
        return None

    return {
        "client_code": raw["clientCode"],
        "first_name": raw.get("firstName"),
        "last_name": raw.get("lastName"),
        "gender": raw.get("gender"),
        "birth_year": to_int(raw.get("birthYear")),
        "is_youth": raw.get("isYouth"),
        "country_iso3": raw.get("countryIso3"),
        "country_iso2": raw.get("countryIso2"),
        "location_name": raw.get("locationName"),
        "region": raw.get("region"),
        "in_camp": raw.get("inCamp"),
        "displacement_status": raw.get("displacementStatus"),
        "origin_country_iso3": raw.get("originCountryIso3"),
        "arrival_year": to_int(raw.get("arrivalYear")),
        "household_size": to_int(raw.get("householdSize")),
        "dependents": to_int(raw.get("dependents")),
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
        "started_year": to_int(raw.get("startedYear")),
        "employees_full_time": to_int(raw.get("employeesFullTime")),
        "employees_part_time": to_int(raw.get("employeesPartTime")),
        "employees_female": to_int(raw.get("employeesFemale")),
        "employees_displaced": to_int(raw.get("employeesDisplaced")),
        "currency": raw.get("currency"),
        "monthly_revenue_local": to_float(raw.get("monthlyRevenueLocal")),
        "monthly_revenue_usd": to_float(raw.get("monthlyRevenueUsd")),
        "monthly_profit_usd": to_float(raw.get("monthlyProfitUsd")),
        "baseline_monthly_revenue_usd": to_float(raw.get("baselineMonthlyRevenueUsd")),
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
        "loan_cycle": to_int(raw.get("loanCycle")),
        "currency": raw.get("currency"),
        "principal_local": to_float(raw.get("principalLocal")),
        "principal_usd": to_float(raw.get("principalUsd")),
        "interest_rate_annual": to_float(raw.get("interestRateAnnual")),
        "term_months": to_int(raw.get("termMonths")),
        "purpose": raw.get("purpose"),
        "risk_grade": raw.get("riskGrade"),
        "applied_on": raw.get("appliedOn"),
        "disbursed_on": raw.get("disbursedOn"),
        "maturity_on": raw.get("maturityOn"),
        "installments_total": to_int(raw.get("installmentsTotal")),
        "installments_paid": to_int(raw.get("installmentsPaid")),
        "total_repayable_usd": to_float(raw.get("totalRepayableUsd")),
        "amount_repaid_usd": to_float(raw.get("amountRepaidUsd")),
        "outstanding_usd": to_float(raw.get("outstandingUsd")),
        "days_past_due": to_int(raw.get("daysPastDue")),
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
        "installment_number": to_int(raw.get("installmentNumber")),
        "currency": raw.get("currency"),
        "amount_local": to_float(raw.get("amountLocal")),
        "amount_usd": to_float(raw.get("amountUsd")),
        "due_on": raw.get("dueOn"),
        "paid_at": raw.get("paidAt"),
        "days_late": to_int(raw.get("daysLate")),
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
        "duration_minutes": to_int(raw.get("durationMinutes")),
        "attended": raw.get("attended"),
        "satisfaction_score": to_int(raw.get("satisfactionScore")),
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
        "revenue_local": to_float(raw.get("revenueLocal")),
        "revenue_usd": to_float(raw.get("revenueUsd")),
        "profit_usd": to_float(raw.get("profitUsd")),
        "employees_total": to_int(raw.get("employeesTotal")),
        "customers_served": to_int(raw.get("customersServed")),
        "revenue_growth_pct": to_float(raw.get("revenueGrowthPct")),
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
