-- Materialized views parse the Debezium envelope and land only
-- create/read/update events (deletes are out of scope for this MVP,
-- see design report "known limitations").

CREATE MATERIALIZED VIEW IF NOT EXISTS worldbank.mv_countries
    TO worldbank.raw_countries AS
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
FROM worldbank.kafka_countries
WHERE JSONExtract(json, 'op', 'String') != 'd';

CREATE MATERIALIZED VIEW IF NOT EXISTS worldbank.mv_indicators
    TO worldbank.raw_indicators AS
SELECT
    JSONExtract(json, 'after', 'code', 'String')                          AS code,
    JSONExtract(json, 'after', 'name', 'String')                          AS name,
    JSONExtract(json, 'after', 'source_note', 'Nullable(String)')         AS source_note,
    JSONExtract(json, 'after', 'source_organization', 'Nullable(String)') AS source_organization,
    JSONExtract(json, 'op', 'String')                                     AS op,
    JSONExtract(json, 'ts_ms', 'Int64')                                   AS ts_ms
FROM worldbank.kafka_indicators
WHERE JSONExtract(json, 'op', 'String') != 'd';

CREATE MATERIALIZED VIEW IF NOT EXISTS worldbank.mv_observations
    TO worldbank.raw_observations AS
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
FROM worldbank.kafka_observations
WHERE JSONExtract(json, 'op', 'String') != 'd';

CREATE MATERIALIZED VIEW IF NOT EXISTS worldbank.mv_refugee_statistics
    TO worldbank.raw_refugee_statistics AS
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
FROM worldbank.kafka_refugee_statistics
WHERE JSONExtract(json, 'op', 'String') != 'd';
