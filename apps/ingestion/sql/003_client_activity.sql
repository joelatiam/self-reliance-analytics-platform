-- Operational client activity replicated from the clients API: the people the
-- program serves, the businesses they run, the loans they take and repay, the
-- coaching they receive and their monthly business results.
--
-- Unlike the World Bank and UNHCR tables, which are yearly country aggregates,
-- these are row-level operational records that change continuously. They are
-- pulled incrementally on each source row's updated_at, so a run only carries
-- what actually moved since the last one.

CREATE TABLE IF NOT EXISTS clients (
    client_code          TEXT PRIMARY KEY,
    first_name           TEXT NOT NULL,
    last_name            TEXT NOT NULL,
    gender               TEXT,
    birth_year           INTEGER,
    is_youth             BOOLEAN,
    country_iso3         TEXT NOT NULL,
    country_iso2         TEXT,
    location_name        TEXT,
    region               TEXT,
    in_camp              BOOLEAN,
    displacement_status  TEXT,
    origin_country_iso3  TEXT,
    arrival_year         INTEGER,
    household_size       INTEGER,
    dependents           INTEGER,
    education_level      TEXT,
    primary_language     TEXT,
    program_track        TEXT,
    cohort               TEXT,
    enrolled_on          DATE,
    advisor_code         TEXT,
    status               TEXT,
    source_updated_at    TIMESTAMPTZ NOT NULL,
    ingested_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_country ON clients (country_iso3);
CREATE INDEX IF NOT EXISTS idx_clients_displacement ON clients (displacement_status);

CREATE TABLE IF NOT EXISTS businesses (
    business_code                 TEXT PRIMARY KEY,
    client_code                   TEXT NOT NULL,
    name                          TEXT NOT NULL,
    sector                        TEXT,
    sub_sector                    TEXT,
    stage                         TEXT,
    registration_status           TEXT,
    market_access                 TEXT,
    country_iso3                  TEXT NOT NULL,
    location_name                 TEXT,
    started_year                  INTEGER,
    employees_full_time           INTEGER,
    employees_part_time           INTEGER,
    employees_female              INTEGER,
    employees_displaced           INTEGER,
    currency                      TEXT,
    monthly_revenue_local         NUMERIC(18, 2),
    monthly_revenue_usd           NUMERIC(18, 2),
    monthly_profit_usd            NUMERIC(18, 2),
    baseline_monthly_revenue_usd  NUMERIC(18, 2),
    status                        TEXT,
    source_updated_at             TIMESTAMPTZ NOT NULL,
    ingested_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_businesses_country ON businesses (country_iso3);
CREATE INDEX IF NOT EXISTS idx_businesses_client ON businesses (client_code);

CREATE TABLE IF NOT EXISTS loans (
    loan_code             TEXT PRIMARY KEY,
    client_code           TEXT NOT NULL,
    business_code         TEXT NOT NULL,
    country_iso3          TEXT NOT NULL,
    loan_cycle            INTEGER,
    currency              TEXT,
    principal_local       NUMERIC(18, 2),
    principal_usd         NUMERIC(18, 2),
    interest_rate_annual  NUMERIC(5, 2),
    term_months           INTEGER,
    purpose               TEXT,
    risk_grade            TEXT,
    applied_on            DATE,
    disbursed_on          DATE,
    maturity_on           DATE,
    installments_total    INTEGER,
    installments_paid     INTEGER,
    total_repayable_usd   NUMERIC(18, 2),
    amount_repaid_usd     NUMERIC(18, 2),
    outstanding_usd       NUMERIC(18, 2),
    days_past_due         INTEGER,
    status                TEXT,
    source_updated_at     TIMESTAMPTZ NOT NULL,
    ingested_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loans_country ON loans (country_iso3);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans (status);

CREATE TABLE IF NOT EXISTS loan_repayments (
    repayment_code      TEXT PRIMARY KEY,
    loan_code           TEXT NOT NULL,
    client_code         TEXT NOT NULL,
    country_iso3        TEXT NOT NULL,
    installment_number  INTEGER,
    currency            TEXT,
    amount_local        NUMERIC(18, 2),
    amount_usd          NUMERIC(18, 2),
    due_on              DATE,
    paid_at             TIMESTAMPTZ,
    days_late           INTEGER,
    on_time             BOOLEAN,
    method              TEXT,
    source_updated_at   TIMESTAMPTZ NOT NULL,
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_repayments_loan ON loan_repayments (loan_code);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_country ON loan_repayments (country_iso3);

CREATE TABLE IF NOT EXISTS advisory_sessions (
    session_code        TEXT PRIMARY KEY,
    client_code         TEXT NOT NULL,
    business_code       TEXT,
    country_iso3        TEXT NOT NULL,
    advisor_code        TEXT,
    session_type        TEXT,
    topic               TEXT,
    language            TEXT,
    delivered_at        TIMESTAMPTZ,
    duration_minutes    INTEGER,
    attended            BOOLEAN,
    satisfaction_score  INTEGER,
    source_updated_at   TIMESTAMPTZ NOT NULL,
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisory_sessions_country ON advisory_sessions (country_iso3);

CREATE TABLE IF NOT EXISTS business_monthly_metrics (
    business_code       TEXT NOT NULL,
    period              TEXT NOT NULL,
    client_code         TEXT NOT NULL,
    country_iso3        TEXT NOT NULL,
    currency            TEXT,
    revenue_local       NUMERIC(18, 2),
    revenue_usd         NUMERIC(18, 2),
    profit_usd          NUMERIC(18, 2),
    employees_total     INTEGER,
    customers_served    INTEGER,
    revenue_growth_pct  NUMERIC(8, 2),
    source_updated_at   TIMESTAMPTZ NOT NULL,
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (business_code, period)
);

CREATE INDEX IF NOT EXISTS idx_business_monthly_metrics_country
    ON business_monthly_metrics (country_iso3);

-- Per-resource high-water marks. Each run reads the mark, asks the API for
-- everything changed since it, and writes back the newest source updated_at it
-- saw — so a crashed run resumes rather than re-pulling from the beginning.
CREATE TABLE IF NOT EXISTS ingestion_watermarks (
    resource      TEXT PRIMARY KEY,
    watermark     TIMESTAMPTZ,
    rows_ingested BIGINT NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE clients REPLICA IDENTITY DEFAULT;
ALTER TABLE businesses REPLICA IDENTITY DEFAULT;
ALTER TABLE loans REPLICA IDENTITY DEFAULT;
ALTER TABLE loan_repayments REPLICA IDENTITY DEFAULT;
ALTER TABLE advisory_sessions REPLICA IDENTITY DEFAULT;
ALTER TABLE business_monthly_metrics REPLICA IDENTITY DEFAULT;
