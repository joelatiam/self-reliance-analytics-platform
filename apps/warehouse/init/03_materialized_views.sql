-- Materialized views parse the Debezium envelope and land only
-- create/read/update events (deletes are out of scope for this MVP,
-- see design report "known limitations").

CREATE MATERIALIZED VIEW IF NOT EXISTS self_reliance.mv_countries
    TO self_reliance.raw_countries AS
SELECT
    JSONExtract(json, 'after', 'iso2_code', 'String')            AS iso2_code,
    JSONExtract(json, 'after', 'iso3_code', 'Nullable(String)')  AS iso3_code,
    JSONExtract(json, 'after', 'name', 'String')                 AS name,
    JSONExtract(json, 'after', 'region', 'Nullable(String)')     AS region,
    JSONExtract(json, 'after', 'income_level', 'Nullable(String)') AS income_level,
    JSONExtract(json, 'after', 'capital_city', 'Nullable(String)') AS capital_city,
    JSONExtract(json, 'after', 'longitude', 'Nullable(Float64)') AS longitude,
    JSONExtract(json, 'after', 'latitude', 'Nullable(Float64)')  AS latitude,
    JSONExtract(json, 'op', 'String')                            AS op,
    JSONExtract(json, 'ts_ms', 'Int64')                          AS ts_ms
FROM self_reliance.kafka_countries
WHERE JSONExtract(json, 'op', 'String') != 'd';

CREATE MATERIALIZED VIEW IF NOT EXISTS self_reliance.mv_indicators
    TO self_reliance.raw_indicators AS
SELECT
    JSONExtract(json, 'after', 'code', 'String')                          AS code,
    JSONExtract(json, 'after', 'name', 'String')                          AS name,
    JSONExtract(json, 'after', 'source_note', 'Nullable(String)')         AS source_note,
    JSONExtract(json, 'after', 'source_organization', 'Nullable(String)') AS source_organization,
    JSONExtract(json, 'op', 'String')                                     AS op,
    JSONExtract(json, 'ts_ms', 'Int64')                                   AS ts_ms
FROM self_reliance.kafka_indicators
WHERE JSONExtract(json, 'op', 'String') != 'd';

CREATE MATERIALIZED VIEW IF NOT EXISTS self_reliance.mv_observations
    TO self_reliance.raw_observations AS
SELECT
    JSONExtract(json, 'after', 'country_code', 'String')          AS country_code,
    JSONExtract(json, 'after', 'indicator_code', 'String')        AS indicator_code,
    JSONExtract(json, 'after', 'year', 'Int32')                   AS year,
    JSONExtract(json, 'after', 'value', 'Nullable(Float64)')      AS value,
    JSONExtract(json, 'after', 'unit', 'Nullable(String)')        AS unit,
    JSONExtract(json, 'after', 'obs_status', 'Nullable(String)')  AS obs_status,
    JSONExtract(json, 'after', 'decimal_places', 'Nullable(Int32)') AS decimal_places,
    JSONExtract(json, 'op', 'String')                             AS op,
    JSONExtract(json, 'ts_ms', 'Int64')                           AS ts_ms
FROM self_reliance.kafka_observations
WHERE JSONExtract(json, 'op', 'String') != 'd';

CREATE MATERIALIZED VIEW IF NOT EXISTS self_reliance.mv_refugee_statistics
    TO self_reliance.raw_refugee_statistics AS
SELECT
    JSONExtract(json, 'after', 'country_iso3', 'String')               AS country_iso3,
    JSONExtract(json, 'after', 'year', 'Int32')                        AS year,
    JSONExtract(json, 'after', 'refugees', 'Nullable(Int64)')          AS refugees,
    JSONExtract(json, 'after', 'asylum_seekers', 'Nullable(Int64)')    AS asylum_seekers,
    JSONExtract(json, 'after', 'returned_refugees', 'Nullable(Int64)') AS returned_refugees,
    JSONExtract(json, 'after', 'idps', 'Nullable(Int64)')              AS idps,
    JSONExtract(json, 'after', 'returned_idps', 'Nullable(Int64)')     AS returned_idps,
    JSONExtract(json, 'after', 'stateless', 'Nullable(Int64)')         AS stateless,
    JSONExtract(json, 'after', 'others_of_concern', 'Nullable(Int64)') AS others_of_concern,
    JSONExtract(json, 'after', 'host_community', 'Nullable(Int64)')    AS host_community,
    JSONExtract(json, 'op', 'String')                                  AS op,
    JSONExtract(json, 'ts_ms', 'Int64')                                AS ts_ms
FROM self_reliance.kafka_refugee_statistics
WHERE JSONExtract(json, 'op', 'String') != 'd';

-- Client activity. Debezium sends DATE as days since epoch (ClickHouse converts
-- that straight into a Date column), TIMESTAMPTZ as an ISO-8601 string, and —
-- with decimal.handling.mode=double on the connector — NUMERIC as a plain
-- number rather than base64 bytes.
CREATE MATERIALIZED VIEW IF NOT EXISTS self_reliance.mv_clients
    TO self_reliance.raw_clients AS
SELECT
    JSONExtract(json, 'after', 'client_code', 'String')                   AS client_code,
    JSONExtract(json, 'after', 'first_name', 'Nullable(String)')          AS first_name,
    JSONExtract(json, 'after', 'last_name', 'Nullable(String)')           AS last_name,
    JSONExtract(json, 'after', 'gender', 'Nullable(String)')              AS gender,
    JSONExtract(json, 'after', 'birth_year', 'Nullable(Int32)')           AS birth_year,
    JSONExtract(json, 'after', 'is_youth', 'Nullable(UInt8)')             AS is_youth,
    JSONExtract(json, 'after', 'country_iso3', 'String')                  AS country_iso3,
    JSONExtract(json, 'after', 'country_iso2', 'Nullable(String)')        AS country_iso2,
    JSONExtract(json, 'after', 'location_name', 'Nullable(String)')       AS location_name,
    JSONExtract(json, 'after', 'region', 'Nullable(String)')              AS region,
    JSONExtract(json, 'after', 'in_camp', 'Nullable(UInt8)')              AS in_camp,
    JSONExtract(json, 'after', 'displacement_status', 'Nullable(String)') AS displacement_status,
    JSONExtract(json, 'after', 'origin_country_iso3', 'Nullable(String)') AS origin_country_iso3,
    JSONExtract(json, 'after', 'arrival_year', 'Nullable(Int32)')         AS arrival_year,
    JSONExtract(json, 'after', 'household_size', 'Nullable(Int32)')       AS household_size,
    JSONExtract(json, 'after', 'dependents', 'Nullable(Int32)')           AS dependents,
    JSONExtract(json, 'after', 'education_level', 'Nullable(String)')     AS education_level,
    JSONExtract(json, 'after', 'primary_language', 'Nullable(String)')    AS primary_language,
    JSONExtract(json, 'after', 'program_track', 'Nullable(String)')       AS program_track,
    JSONExtract(json, 'after', 'cohort', 'Nullable(String)')              AS cohort,
    JSONExtract(json, 'after', 'enrolled_on', 'Nullable(Int32)')          AS enrolled_on,
    JSONExtract(json, 'after', 'advisor_code', 'Nullable(String)')        AS advisor_code,
    JSONExtract(json, 'after', 'status', 'Nullable(String)')              AS status,
    JSONExtract(json, 'op', 'String')                                     AS op,
    JSONExtract(json, 'ts_ms', 'Int64')                                   AS ts_ms
FROM self_reliance.kafka_clients
WHERE JSONExtract(json, 'op', 'String') != 'd';

CREATE MATERIALIZED VIEW IF NOT EXISTS self_reliance.mv_businesses
    TO self_reliance.raw_businesses AS
SELECT
    JSONExtract(json, 'after', 'business_code', 'String')                          AS business_code,
    JSONExtract(json, 'after', 'client_code', 'String')                            AS client_code,
    JSONExtract(json, 'after', 'name', 'Nullable(String)')                         AS name,
    JSONExtract(json, 'after', 'sector', 'Nullable(String)')                       AS sector,
    JSONExtract(json, 'after', 'sub_sector', 'Nullable(String)')                   AS sub_sector,
    JSONExtract(json, 'after', 'stage', 'Nullable(String)')                        AS stage,
    JSONExtract(json, 'after', 'registration_status', 'Nullable(String)')          AS registration_status,
    JSONExtract(json, 'after', 'market_access', 'Nullable(String)')                AS market_access,
    JSONExtract(json, 'after', 'country_iso3', 'String')                           AS country_iso3,
    JSONExtract(json, 'after', 'location_name', 'Nullable(String)')                AS location_name,
    JSONExtract(json, 'after', 'started_year', 'Nullable(Int32)')                  AS started_year,
    JSONExtract(json, 'after', 'employees_full_time', 'Nullable(Int32)')           AS employees_full_time,
    JSONExtract(json, 'after', 'employees_part_time', 'Nullable(Int32)')           AS employees_part_time,
    JSONExtract(json, 'after', 'employees_female', 'Nullable(Int32)')              AS employees_female,
    JSONExtract(json, 'after', 'employees_displaced', 'Nullable(Int32)')           AS employees_displaced,
    JSONExtract(json, 'after', 'currency', 'Nullable(String)')                     AS currency,
    JSONExtract(json, 'after', 'monthly_revenue_local', 'Nullable(Float64)')       AS monthly_revenue_local,
    JSONExtract(json, 'after', 'monthly_revenue_usd', 'Nullable(Float64)')         AS monthly_revenue_usd,
    JSONExtract(json, 'after', 'monthly_profit_usd', 'Nullable(Float64)')          AS monthly_profit_usd,
    JSONExtract(json, 'after', 'baseline_monthly_revenue_usd', 'Nullable(Float64)') AS baseline_monthly_revenue_usd,
    JSONExtract(json, 'after', 'status', 'Nullable(String)')                       AS status,
    JSONExtract(json, 'op', 'String')                                              AS op,
    JSONExtract(json, 'ts_ms', 'Int64')                                            AS ts_ms
FROM self_reliance.kafka_businesses
WHERE JSONExtract(json, 'op', 'String') != 'd';

CREATE MATERIALIZED VIEW IF NOT EXISTS self_reliance.mv_loans
    TO self_reliance.raw_loans AS
SELECT
    JSONExtract(json, 'after', 'loan_code', 'String')                        AS loan_code,
    JSONExtract(json, 'after', 'client_code', 'String')                      AS client_code,
    JSONExtract(json, 'after', 'business_code', 'String')                    AS business_code,
    JSONExtract(json, 'after', 'country_iso3', 'String')                     AS country_iso3,
    JSONExtract(json, 'after', 'loan_cycle', 'Nullable(Int32)')              AS loan_cycle,
    JSONExtract(json, 'after', 'currency', 'Nullable(String)')               AS currency,
    JSONExtract(json, 'after', 'principal_local', 'Nullable(Float64)')       AS principal_local,
    JSONExtract(json, 'after', 'principal_usd', 'Nullable(Float64)')         AS principal_usd,
    JSONExtract(json, 'after', 'interest_rate_annual', 'Nullable(Float64)')  AS interest_rate_annual,
    JSONExtract(json, 'after', 'term_months', 'Nullable(Int32)')             AS term_months,
    JSONExtract(json, 'after', 'purpose', 'Nullable(String)')                AS purpose,
    JSONExtract(json, 'after', 'risk_grade', 'Nullable(String)')             AS risk_grade,
    JSONExtract(json, 'after', 'applied_on', 'Nullable(Int32)')              AS applied_on,
    JSONExtract(json, 'after', 'disbursed_on', 'Nullable(Int32)')            AS disbursed_on,
    JSONExtract(json, 'after', 'maturity_on', 'Nullable(Int32)')             AS maturity_on,
    JSONExtract(json, 'after', 'installments_total', 'Nullable(Int32)')      AS installments_total,
    JSONExtract(json, 'after', 'installments_paid', 'Nullable(Int32)')       AS installments_paid,
    JSONExtract(json, 'after', 'total_repayable_usd', 'Nullable(Float64)')   AS total_repayable_usd,
    JSONExtract(json, 'after', 'amount_repaid_usd', 'Nullable(Float64)')     AS amount_repaid_usd,
    JSONExtract(json, 'after', 'outstanding_usd', 'Nullable(Float64)')       AS outstanding_usd,
    JSONExtract(json, 'after', 'days_past_due', 'Nullable(Int32)')           AS days_past_due,
    JSONExtract(json, 'after', 'status', 'Nullable(String)')                 AS status,
    JSONExtract(json, 'op', 'String')                                        AS op,
    JSONExtract(json, 'ts_ms', 'Int64')                                      AS ts_ms
FROM self_reliance.kafka_loans
WHERE JSONExtract(json, 'op', 'String') != 'd';

CREATE MATERIALIZED VIEW IF NOT EXISTS self_reliance.mv_loan_repayments
    TO self_reliance.raw_loan_repayments AS
SELECT
    JSONExtract(json, 'after', 'repayment_code', 'String')                AS repayment_code,
    JSONExtract(json, 'after', 'loan_code', 'String')                     AS loan_code,
    JSONExtract(json, 'after', 'client_code', 'String')                   AS client_code,
    JSONExtract(json, 'after', 'country_iso3', 'String')                  AS country_iso3,
    JSONExtract(json, 'after', 'installment_number', 'Nullable(Int32)')   AS installment_number,
    JSONExtract(json, 'after', 'currency', 'Nullable(String)')            AS currency,
    JSONExtract(json, 'after', 'amount_local', 'Nullable(Float64)')       AS amount_local,
    JSONExtract(json, 'after', 'amount_usd', 'Nullable(Float64)')         AS amount_usd,
    JSONExtract(json, 'after', 'due_on', 'Nullable(Int32)')               AS due_on,
    parseDateTime64BestEffortOrNull(
        JSONExtract(json, 'after', 'paid_at', 'Nullable(String)'), 3)      AS paid_at,
    JSONExtract(json, 'after', 'days_late', 'Nullable(Int32)')            AS days_late,
    JSONExtract(json, 'after', 'on_time', 'Nullable(UInt8)')              AS on_time,
    JSONExtract(json, 'after', 'method', 'Nullable(String)')              AS method,
    JSONExtract(json, 'op', 'String')                                     AS op,
    JSONExtract(json, 'ts_ms', 'Int64')                                   AS ts_ms
FROM self_reliance.kafka_loan_repayments
WHERE JSONExtract(json, 'op', 'String') != 'd';

CREATE MATERIALIZED VIEW IF NOT EXISTS self_reliance.mv_advisory_sessions
    TO self_reliance.raw_advisory_sessions AS
SELECT
    JSONExtract(json, 'after', 'session_code', 'String')                  AS session_code,
    JSONExtract(json, 'after', 'client_code', 'String')                   AS client_code,
    JSONExtract(json, 'after', 'business_code', 'Nullable(String)')       AS business_code,
    JSONExtract(json, 'after', 'country_iso3', 'String')                  AS country_iso3,
    JSONExtract(json, 'after', 'advisor_code', 'Nullable(String)')        AS advisor_code,
    JSONExtract(json, 'after', 'session_type', 'Nullable(String)')        AS session_type,
    JSONExtract(json, 'after', 'topic', 'Nullable(String)')               AS topic,
    JSONExtract(json, 'after', 'language', 'Nullable(String)')            AS language,
    parseDateTime64BestEffortOrNull(
        JSONExtract(json, 'after', 'delivered_at', 'Nullable(String)'), 3) AS delivered_at,
    JSONExtract(json, 'after', 'duration_minutes', 'Nullable(Int32)')     AS duration_minutes,
    JSONExtract(json, 'after', 'attended', 'Nullable(UInt8)')             AS attended,
    JSONExtract(json, 'after', 'satisfaction_score', 'Nullable(Int32)')   AS satisfaction_score,
    JSONExtract(json, 'op', 'String')                                     AS op,
    JSONExtract(json, 'ts_ms', 'Int64')                                   AS ts_ms
FROM self_reliance.kafka_advisory_sessions
WHERE JSONExtract(json, 'op', 'String') != 'd';

CREATE MATERIALIZED VIEW IF NOT EXISTS self_reliance.mv_business_monthly_metrics
    TO self_reliance.raw_business_monthly_metrics AS
SELECT
    JSONExtract(json, 'after', 'business_code', 'String')                 AS business_code,
    JSONExtract(json, 'after', 'period', 'String')                        AS period,
    JSONExtract(json, 'after', 'client_code', 'String')                   AS client_code,
    JSONExtract(json, 'after', 'country_iso3', 'String')                  AS country_iso3,
    JSONExtract(json, 'after', 'currency', 'Nullable(String)')            AS currency,
    JSONExtract(json, 'after', 'revenue_local', 'Nullable(Float64)')      AS revenue_local,
    JSONExtract(json, 'after', 'revenue_usd', 'Nullable(Float64)')        AS revenue_usd,
    JSONExtract(json, 'after', 'profit_usd', 'Nullable(Float64)')         AS profit_usd,
    JSONExtract(json, 'after', 'employees_total', 'Nullable(Int32)')      AS employees_total,
    JSONExtract(json, 'after', 'customers_served', 'Nullable(Int32)')     AS customers_served,
    JSONExtract(json, 'after', 'revenue_growth_pct', 'Nullable(Float64)') AS revenue_growth_pct,
    JSONExtract(json, 'op', 'String')                                     AS op,
    JSONExtract(json, 'ts_ms', 'Int64')                                   AS ts_ms
FROM self_reliance.kafka_business_monthly_metrics
WHERE JSONExtract(json, 'op', 'String') != 'd';
