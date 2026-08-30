-- Representative rows for CI, standing in for what CDC would normally land.
-- Not mounted into the real docker-entrypoint-initdb.d flow.
INSERT INTO self_reliance.raw_countries
    (iso2_code, iso3_code, name, region, income_level, capital_city, longitude, latitude, op, ts_ms)
VALUES
    ('RW', 'RWA', 'Rwanda', 'Sub-Saharan Africa', 'Low income', 'Kigali', 30.06, -1.94, 'r', 1000),
    ('KE', 'KEN', 'Kenya', 'Sub-Saharan Africa', 'Lower middle income', 'Nairobi', 36.82, -1.29, 'r', 1000);

INSERT INTO self_reliance.raw_indicators
    (code, name, source_note, source_organization, op, ts_ms)
VALUES
    ('NY.GDP.MKTP.KD.ZG', 'GDP growth (annual %)', 'Annual GDP growth rate.', 'World Bank', 'r', 1000);

INSERT INTO self_reliance.raw_observations
    (country_code, indicator_code, year, value, unit, obs_status, decimal_places, op, ts_ms)
VALUES
    ('RW', 'NY.GDP.MKTP.KD.ZG', 2022, 9.82, NULL, NULL, 1, 'r', 1000),
    ('RW', 'NY.GDP.MKTP.KD.ZG', 2023, 8.55, NULL, NULL, 1, 'r', 1000),
    ('KE', 'NY.GDP.MKTP.KD.ZG', 2022, 5.6, NULL, NULL, 1, 'r', 1000),
    ('KE', 'NY.GDP.MKTP.KD.ZG', 2023, 5.0, NULL, NULL, 1, 'r', 1000);

INSERT INTO self_reliance.raw_refugee_statistics
    (country_iso3, year, refugees, asylum_seekers, returned_refugees, idps, returned_idps, stateless, others_of_concern, host_community, op, ts_ms)
VALUES
    ('RWA', 2022, 120753, 478, 932, 0, 0, 9500, 6515, 11972, 'r', 1000),
    ('RWA', 2023, 115643, 12660, 325, 0, 0, 9500, 7060, 12139, 'r', 1000),
    ('KEN', 2022, 550000, 20000, 100, 0, 0, 18500, 3000, 5000, 'r', 1000),
    ('KEN', 2023, 585000, 22000, 150, 0, 0, 18500, 3200, 5100, 'r', 1000);

-- Client activity. Two clients per country with contrasting profiles: a
-- displaced borrower who repays on time and a host-community borrower who falls
-- into arrears, so the mart tests exercise both the on-time and at-risk paths.
INSERT INTO self_reliance.raw_clients
    (client_code, first_name, last_name, gender, birth_year, is_youth, country_iso3, country_iso2,
     location_name, region, in_camp, displacement_status, origin_country_iso3, arrival_year,
     household_size, dependents, education_level, primary_language, program_track, cohort,
     enrolled_on, advisor_code, status, op, ts_ms)
VALUES
    ('SR-C-RWA-000001', 'Esperance', 'Uwimana', 'FEMALE', 1991, 1, 'RWA', 'RW',
     'Mahama Camp', 'Kirehe', 1, 'REFUGEE', 'BDI', 2018,
     6, 4, 'SECONDARY', 'Kirundi', 'FINANCING', '2025-Q1',
     '2025-02-10', 'SR-ADV-RWA-003', 'ACTIVE', 'r', 1000),
    ('SR-C-RWA-000002', 'Patrick', 'Mugisha', 'MALE', 1984, 0, 'RWA', 'RW',
     'Huye', 'Southern Province', 0, 'HOST_COMMUNITY', NULL, NULL,
     5, 3, 'VOCATIONAL', 'Kinyarwanda', 'ADVISORY', '2025-Q2',
     '2025-05-04', 'SR-ADV-RWA-007', 'ACTIVE', 'r', 1000),
    ('SR-C-KEN-000001', 'Amina', 'Warsame', 'FEMALE', 1994, 1, 'KEN', 'KE',
     'Kalobeyei Settlement', 'Turkana', 1, 'REFUGEE', 'SOM', 2017,
     7, 5, 'PRIMARY', 'Somali', 'FINANCING', '2025-Q1',
     '2025-01-22', 'SR-ADV-KEN-004', 'ACTIVE', 'r', 1000),
    ('SR-C-KEN-000002', 'Hassan', 'Noor', 'MALE', 1996, 1, 'KEN', 'KE',
     'Lodwar', 'Turkana', 0, 'HOST_COMMUNITY', NULL, NULL,
     4, 2, 'SECONDARY', 'Swahili', 'MARKET_ACCESS', '2025-Q3',
     '2025-08-15', 'SR-ADV-KEN-009', 'ACTIVE', 'r', 1000);

INSERT INTO self_reliance.raw_businesses
    (business_code, client_code, name, sector, sub_sector, stage, registration_status, market_access,
     country_iso3, location_name, started_year, employees_full_time, employees_part_time,
     employees_female, employees_displaced, currency, monthly_revenue_local, monthly_revenue_usd,
     monthly_profit_usd, baseline_monthly_revenue_usd, status, op, ts_ms)
VALUES
    ('SR-B-RWA-000001', 'SR-C-RWA-000001', 'Amani Tailoring', 'Tailoring & Textiles', 'Tailoring',
     'ESTABLISHED', 'INFORMAL', 'HOST_MARKET', 'RWA', 'Mahama Camp', 2021, 2, 1,
     3, 2, 'RWF', 731700.00, 540.00, 145.80, 360.00, 'ACTIVE', 'r', 1000),
    ('SR-B-RWA-000002', 'SR-C-RWA-000002', 'Mugisha Hardware', 'Construction & Materials', 'Hardware shop',
     'GROWTH', 'REGISTERED', 'REGIONAL', 'RWA', 'Huye', 2019, 4, 2,
     2, 0, 'RWF', 1897000.00, 1400.00, 294.00, 1100.00, 'ACTIVE', 'r', 1000),
    ('SR-B-KEN-000001', 'SR-C-KEN-000001', 'Amani General Supplies', 'Retail & Trade', 'General shop',
     'ESTABLISHED', 'INFORMAL', 'HOST_MARKET', 'KEN', 'Kalobeyei Settlement', 2021, 2, 1,
     2, 3, 'KES', 109650.00, 850.00, 161.50, 520.00, 'ACTIVE', 'r', 1000),
    ('SR-B-KEN-000002', 'SR-C-KEN-000002', 'Lodwar Boda Services', 'Transport & Logistics', 'Motorcycle taxi',
     'STARTUP', 'INFORMAL', 'HOST_MARKET', 'KEN', 'Lodwar', 2024, 1, 0,
     0, 0, 'KES', 38700.00, 300.00, 90.00, 260.00, 'ACTIVE', 'r', 1000);

INSERT INTO self_reliance.raw_loans
    (loan_code, client_code, business_code, country_iso3, loan_cycle, currency, principal_local,
     principal_usd, interest_rate_annual, term_months, purpose, risk_grade, applied_on, disbursed_on,
     maturity_on, installments_total, installments_paid, total_repayable_usd, amount_repaid_usd,
     outstanding_usd, days_past_due, status, op, ts_ms)
VALUES
    ('SR-L-RWA-000001', 'SR-C-RWA-000001', 'SR-B-RWA-000001', 'RWA', 2, 'RWF', 677500.00,
     500.00, 12.00, 12, 'EQUIPMENT', 'B', '2025-03-01', '2025-03-05',
     '2026-03-05', 12, 12, 560.00, 560.00, 0.00, 0, 'REPAID', 'r', 1000),
    ('SR-L-RWA-000002', 'SR-C-RWA-000002', 'SR-B-RWA-000002', 'RWA', 1, 'RWF', 2710000.00,
     2000.00, 14.00, 18, 'EXPANSION', 'C', '2025-06-01', '2025-06-10',
     '2026-12-10', 18, 4, 2420.00, 537.78, 1882.22, 45, 'LATE', 'r', 1000),
    ('SR-L-KEN-000001', 'SR-C-KEN-000001', 'SR-B-KEN-000001', 'KEN', 2, 'KES', 96750.00,
     750.00, 12.50, 12, 'INVENTORY', 'B', '2025-02-02', '2025-02-05',
     '2026-02-05', 12, 6, 843.75, 421.88, 421.87, 0, 'REPAYING', 'r', 1000),
    ('SR-L-KEN-000002', 'SR-C-KEN-000002', 'SR-B-KEN-000002', 'KEN', 1, 'KES', 51600.00,
     400.00, 15.00, 9, 'WORKING_CAPITAL', 'D', '2025-09-01', '2025-09-08',
     '2026-06-08', 9, 1, 445.00, 49.44, 395.56, 62, 'LATE', 'r', 1000);

INSERT INTO self_reliance.raw_loan_repayments
    (repayment_code, loan_code, client_code, country_iso3, installment_number, currency,
     amount_local, amount_usd, due_on, paid_at, days_late, on_time, method, op, ts_ms)
VALUES
    ('SR-R-RWA-000001', 'SR-L-RWA-000001', 'SR-C-RWA-000001', 'RWA', 11, 'RWF',
     63242.00, 46.67, '2026-02-05', '2026-02-04 09:12:00.000', 0, 1, 'MOBILE_MONEY', 'r', 1000),
    ('SR-R-RWA-000002', 'SR-L-RWA-000001', 'SR-C-RWA-000001', 'RWA', 12, 'RWF',
     63242.00, 46.67, '2026-03-05', '2026-03-05 15:40:00.000', 0, 1, 'MOBILE_MONEY', 'r', 1000),
    ('SR-R-RWA-000003', 'SR-L-RWA-000002', 'SR-C-RWA-000002', 'RWA', 4, 'RWF',
     182114.00, 134.44, '2026-02-10', '2026-03-27 11:05:00.000', 45, 0, 'BANK_TRANSFER', 'r', 1000),
    ('SR-R-KEN-000001', 'SR-L-KEN-000001', 'SR-C-KEN-000001', 'KEN', 5, 'KES',
     9067.00, 70.31, '2026-02-05', '2026-02-03 08:30:00.000', 0, 1, 'MOBILE_MONEY', 'r', 1000),
    ('SR-R-KEN-000002', 'SR-L-KEN-000001', 'SR-C-KEN-000001', 'KEN', 6, 'KES',
     9067.00, 70.31, '2026-03-05', '2026-03-05 17:22:00.000', 0, 1, 'MOBILE_MONEY', 'r', 1000),
    ('SR-R-KEN-000003', 'SR-L-KEN-000002', 'SR-C-KEN-000002', 'KEN', 1, 'KES',
     6378.00, 49.44, '2026-01-08', '2026-03-11 12:00:00.000', 62, 0, 'CASH', 'r', 1000);

INSERT INTO self_reliance.raw_advisory_sessions
    (session_code, client_code, business_code, country_iso3, advisor_code, session_type, topic,
     language, delivered_at, duration_minutes, attended, satisfaction_score, op, ts_ms)
VALUES
    ('SR-A-RWA-000001', 'SR-C-RWA-000001', 'SR-B-RWA-000001', 'RWA', 'SR-ADV-RWA-003',
     'BOOKKEEPING', 'Record keeping basics', 'Kirundi', '2026-02-12 10:00:00.000', 90, 1, 5, 'r', 1000),
    ('SR-A-RWA-000002', 'SR-C-RWA-000002', 'SR-B-RWA-000002', 'RWA', 'SR-ADV-RWA-007',
     'LOAN_READINESS', 'Cash flow forecasting', 'Kinyarwanda', '2026-03-02 14:00:00.000', 60, 0, NULL, 'r', 1000),
    ('SR-A-KEN-000001', 'SR-C-KEN-000001', 'SR-B-KEN-000001', 'KEN', 'SR-ADV-KEN-004',
     'MARKET_LINKAGE', 'Market linkage to host traders', 'Somali', '2026-02-20 09:30:00.000', 120, 1, 4, 'r', 1000);

INSERT INTO self_reliance.raw_business_monthly_metrics
    (business_code, period, client_code, country_iso3, currency, revenue_local, revenue_usd,
     profit_usd, employees_total, customers_served, revenue_growth_pct, op, ts_ms)
VALUES
    ('SR-B-RWA-000001', '2026-02', 'SR-C-RWA-000001', 'RWA', 'RWF', 704600.00, 520.00, 140.40, 3, 210, 44.44, 'r', 1000),
    ('SR-B-RWA-000001', '2026-03', 'SR-C-RWA-000001', 'RWA', 'RWF', 731700.00, 540.00, 145.80, 3, 224, 50.00, 'r', 1000),
    ('SR-B-RWA-000002', '2026-03', 'SR-C-RWA-000002', 'RWA', 'RWF', 1897000.00, 1400.00, 294.00, 6, 180, 27.27, 'r', 1000),
    ('SR-B-KEN-000001', '2026-02', 'SR-C-KEN-000001', 'KEN', 'KES', 103200.00, 800.00, 152.00, 3, 298, 53.85, 'r', 1000),
    ('SR-B-KEN-000001', '2026-03', 'SR-C-KEN-000001', 'KEN', 'KES', 109650.00, 850.00, 161.50, 3, 312, 63.46, 'r', 1000),
    ('SR-B-KEN-000002', '2026-03', 'SR-C-KEN-000002', 'KEN', 'KES', 38700.00, 300.00, 90.00, 1, 145, 15.38, 'r', 1000);
