-- Representative rows for CI, standing in for what CDC would normally land.
-- Not mounted into the real docker-entrypoint-initdb.d flow.
INSERT INTO worldbank.raw_countries
    (iso2_code, iso3_code, name, region, income_level, capital_city, longitude, latitude, op, ts_ms)
VALUES
    ('RW', 'RWA', 'Rwanda', 'Sub-Saharan Africa', 'Low income', 'Kigali', 30.06, -1.94, 'r', 1000),
    ('KE', 'KEN', 'Kenya', 'Sub-Saharan Africa', 'Lower middle income', 'Nairobi', 36.82, -1.29, 'r', 1000);

INSERT INTO worldbank.raw_indicators
    (code, name, source_note, source_organization, op, ts_ms)
VALUES
    ('NY.GDP.MKTP.KD.ZG', 'GDP growth (annual %)', 'Annual GDP growth rate.', 'World Bank', 'r', 1000);

INSERT INTO worldbank.raw_observations
    (country_code, indicator_code, year, value, unit, obs_status, decimal_places, op, ts_ms)
VALUES
    ('RW', 'NY.GDP.MKTP.KD.ZG', 2022, 9.82, NULL, NULL, 1, 'r', 1000),
    ('RW', 'NY.GDP.MKTP.KD.ZG', 2023, 8.55, NULL, NULL, 1, 'r', 1000),
    ('KE', 'NY.GDP.MKTP.KD.ZG', 2022, 5.6, NULL, NULL, 1, 'r', 1000),
    ('KE', 'NY.GDP.MKTP.KD.ZG', 2023, 5.0, NULL, NULL, 1, 'r', 1000);
