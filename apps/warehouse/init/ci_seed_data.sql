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

INSERT INTO worldbank.raw_refugee_statistics
    (country_iso3, year, refugees, asylum_seekers, returned_refugees, idps, returned_idps, stateless, others_of_concern, host_community, op, ts_ms)
VALUES
    ('RWA', 2022, 120753, 478, 932, 0, 0, 9500, 6515, 11972, 'r', 1000),
    ('RWA', 2023, 115643, 12660, 325, 0, 0, 9500, 7060, 12139, 'r', 1000),
    ('KEN', 2022, 550000, 20000, 100, 0, 0, 18500, 3000, 5000, 'r', 1000),
    ('KEN', 2023, 585000, 22000, 150, 0, 0, 18500, 3200, 5100, 'r', 1000);
