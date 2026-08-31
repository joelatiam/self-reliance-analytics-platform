-- Raw (CDC-landed) layer: one ReplacingMergeTree per source table.
-- ts_ms (Debezium event timestamp) is the version column, so a later
-- update for the same key always wins on merge / with FINAL.

CREATE TABLE IF NOT EXISTS worldbank.raw_countries
(
    iso2_code    String,
    iso3_code    Nullable(String),
    name         String,
    region       Nullable(String),
    income_level Nullable(String),
    capital_city Nullable(String),
    longitude    Nullable(Float64),
    latitude     Nullable(Float64),
    op           LowCardinality(String),
    ts_ms        Int64,
    _loaded_at   DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(ts_ms)
ORDER BY iso2_code;

CREATE TABLE IF NOT EXISTS worldbank.raw_indicators
(
    code                String,
    name                String,
    source_note         Nullable(String),
    source_organization Nullable(String),
    op                  LowCardinality(String),
    ts_ms               Int64,
    _loaded_at          DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(ts_ms)
ORDER BY code;

CREATE TABLE IF NOT EXISTS worldbank.raw_observations
(
    country_code   String,
    indicator_code String,
    year           Int32,
    value          Nullable(Float64),
    unit           Nullable(String),
    obs_status     Nullable(String),
    decimal_places Nullable(Int32),
    op             LowCardinality(String),
    ts_ms          Int64,
    _loaded_at     DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(ts_ms)
ORDER BY (country_code, indicator_code, year);

CREATE TABLE IF NOT EXISTS worldbank.raw_refugee_statistics
(
    country_iso3       String,
    year               Int32,
    refugees           Nullable(Int64),
    asylum_seekers     Nullable(Int64),
    returned_refugees  Nullable(Int64),
    idps               Nullable(Int64),
    returned_idps      Nullable(Int64),
    stateless          Nullable(Int64),
    others_of_concern  Nullable(Int64),
    host_community     Nullable(Int64),
    op                 LowCardinality(String),
    ts_ms              Int64,
    _loaded_at         DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(ts_ms)
ORDER BY (country_iso3, year);

-- Client activity. These are mutable operational rows rather than yearly
-- aggregates, so the ReplacingMergeTree version column matters more here: the
-- same loan is replicated again on every repayment, and FINAL (or the dbt
-- staging layer) collapses it to the latest state.
CREATE TABLE IF NOT EXISTS worldbank.raw_clients
(
    client_code          String,
    first_name           Nullable(String),
    last_name            Nullable(String),
    gender               LowCardinality(Nullable(String)),
    birth_year           Nullable(Int32),
    is_youth             Nullable(UInt8),
    country_iso3         LowCardinality(String),
    country_iso2         LowCardinality(Nullable(String)),
    location_name        Nullable(String),
    region               Nullable(String),
    in_camp              Nullable(UInt8),
    displacement_status  LowCardinality(Nullable(String)),
    origin_country_iso3  LowCardinality(Nullable(String)),
    arrival_year         Nullable(Int32),
    household_size       Nullable(Int32),
    dependents           Nullable(Int32),
    education_level      LowCardinality(Nullable(String)),
    primary_language     LowCardinality(Nullable(String)),
    program_track        LowCardinality(Nullable(String)),
    cohort               LowCardinality(Nullable(String)),
    enrolled_on          Nullable(Date),
    advisor_code         Nullable(String),
    status               LowCardinality(Nullable(String)),
    op                   LowCardinality(String),
    ts_ms                Int64,
    _loaded_at           DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(ts_ms)
ORDER BY (country_iso3, client_code);

CREATE TABLE IF NOT EXISTS worldbank.raw_businesses
(
    business_code                 String,
    client_code                   String,
    name                          Nullable(String),
    sector                        LowCardinality(Nullable(String)),
    sub_sector                    Nullable(String),
    stage                         LowCardinality(Nullable(String)),
    registration_status           LowCardinality(Nullable(String)),
    market_access                 LowCardinality(Nullable(String)),
    country_iso3                  LowCardinality(String),
    location_name                 Nullable(String),
    started_year                  Nullable(Int32),
    employees_full_time           Nullable(Int32),
    employees_part_time           Nullable(Int32),
    employees_female              Nullable(Int32),
    employees_displaced           Nullable(Int32),
    currency                      LowCardinality(Nullable(String)),
    monthly_revenue_local         Nullable(Decimal(18, 2)),
    monthly_revenue_usd           Nullable(Decimal(18, 2)),
    monthly_profit_usd            Nullable(Decimal(18, 2)),
    baseline_monthly_revenue_usd  Nullable(Decimal(18, 2)),
    status                        LowCardinality(Nullable(String)),
    op                            LowCardinality(String),
    ts_ms                         Int64,
    _loaded_at                    DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(ts_ms)
ORDER BY (country_iso3, business_code);

CREATE TABLE IF NOT EXISTS worldbank.raw_loans
(
    loan_code             String,
    client_code           String,
    business_code         String,
    country_iso3          LowCardinality(String),
    loan_cycle            Nullable(Int32),
    currency              LowCardinality(Nullable(String)),
    principal_local       Nullable(Decimal(18, 2)),
    principal_usd         Nullable(Decimal(18, 2)),
    interest_rate_annual  Nullable(Decimal(5, 2)),
    term_months           Nullable(Int32),
    purpose               LowCardinality(Nullable(String)),
    risk_grade            LowCardinality(Nullable(String)),
    applied_on            Nullable(Date),
    disbursed_on          Nullable(Date),
    maturity_on           Nullable(Date),
    installments_total    Nullable(Int32),
    installments_paid     Nullable(Int32),
    total_repayable_usd   Nullable(Decimal(18, 2)),
    amount_repaid_usd     Nullable(Decimal(18, 2)),
    outstanding_usd       Nullable(Decimal(18, 2)),
    days_past_due         Nullable(Int32),
    status                LowCardinality(Nullable(String)),
    op                    LowCardinality(String),
    ts_ms                 Int64,
    _loaded_at            DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(ts_ms)
ORDER BY (country_iso3, loan_code);

CREATE TABLE IF NOT EXISTS worldbank.raw_loan_repayments
(
    repayment_code      String,
    loan_code           String,
    client_code         String,
    country_iso3        LowCardinality(String),
    installment_number  Nullable(Int32),
    currency            LowCardinality(Nullable(String)),
    amount_local        Nullable(Decimal(18, 2)),
    amount_usd          Nullable(Decimal(18, 2)),
    due_on              Nullable(Date),
    paid_at             Nullable(DateTime64(3)),
    days_late           Nullable(Int32),
    on_time             Nullable(UInt8),
    method              LowCardinality(Nullable(String)),
    op                  LowCardinality(String),
    ts_ms               Int64,
    _loaded_at          DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(ts_ms)
ORDER BY (country_iso3, repayment_code);

CREATE TABLE IF NOT EXISTS worldbank.raw_advisory_sessions
(
    session_code        String,
    client_code         String,
    business_code       Nullable(String),
    country_iso3        LowCardinality(String),
    advisor_code        Nullable(String),
    session_type        LowCardinality(Nullable(String)),
    topic               Nullable(String),
    language            LowCardinality(Nullable(String)),
    delivered_at        Nullable(DateTime64(3)),
    duration_minutes    Nullable(Int32),
    attended            Nullable(UInt8),
    satisfaction_score  Nullable(Int32),
    op                  LowCardinality(String),
    ts_ms               Int64,
    _loaded_at          DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(ts_ms)
ORDER BY (country_iso3, session_code);

CREATE TABLE IF NOT EXISTS worldbank.raw_business_monthly_metrics
(
    business_code       String,
    period              String,
    client_code         String,
    country_iso3        LowCardinality(String),
    currency            LowCardinality(Nullable(String)),
    revenue_local       Nullable(Decimal(18, 2)),
    revenue_usd         Nullable(Decimal(18, 2)),
    profit_usd          Nullable(Decimal(18, 2)),
    employees_total     Nullable(Int32),
    customers_served    Nullable(Int32),
    revenue_growth_pct  Nullable(Decimal(8, 2)),
    op                  LowCardinality(String),
    ts_ms               Int64,
    _loaded_at          DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(ts_ms)
ORDER BY (country_iso3, business_code, period);
