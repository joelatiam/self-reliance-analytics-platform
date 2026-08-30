-- Kafka engine tables read Debezium's CDC topics as raw JSON strings.
-- JSONAsString sidesteps declaring the full Debezium envelope schema;
-- materialized views below extract only the fields we need.
CREATE DATABASE IF NOT EXISTS worldbank;

CREATE TABLE IF NOT EXISTS worldbank.kafka_countries (json String)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'wb.public.countries',
    kafka_group_name = 'clickhouse_countries_consumer',
    kafka_format = 'JSONAsString',
    kafka_num_consumers = 1;

CREATE TABLE IF NOT EXISTS worldbank.kafka_indicators (json String)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'wb.public.indicators',
    kafka_group_name = 'clickhouse_indicators_consumer',
    kafka_format = 'JSONAsString',
    kafka_num_consumers = 1;

CREATE TABLE IF NOT EXISTS worldbank.kafka_observations (json String)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'wb.public.observations',
    kafka_group_name = 'clickhouse_observations_consumer',
    kafka_format = 'JSONAsString',
    kafka_num_consumers = 1;

CREATE TABLE IF NOT EXISTS worldbank.kafka_refugee_statistics (json String)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'wb.public.refugee_statistics',
    kafka_group_name = 'clickhouse_refugee_statistics_consumer',
    kafka_format = 'JSONAsString',
    kafka_num_consumers = 1;
