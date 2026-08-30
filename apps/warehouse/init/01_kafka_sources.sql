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

-- Client activity: row-level operational records, replicated from the clients
-- API through the same Debezium topics as everything else.
CREATE TABLE IF NOT EXISTS worldbank.kafka_clients (json String)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'wb.public.clients',
    kafka_group_name = 'clickhouse_clients_consumer',
    kafka_format = 'JSONAsString',
    kafka_num_consumers = 1;

CREATE TABLE IF NOT EXISTS worldbank.kafka_businesses (json String)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'wb.public.businesses',
    kafka_group_name = 'clickhouse_businesses_consumer',
    kafka_format = 'JSONAsString',
    kafka_num_consumers = 1;

CREATE TABLE IF NOT EXISTS worldbank.kafka_loans (json String)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'wb.public.loans',
    kafka_group_name = 'clickhouse_loans_consumer',
    kafka_format = 'JSONAsString',
    kafka_num_consumers = 1;

CREATE TABLE IF NOT EXISTS worldbank.kafka_loan_repayments (json String)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'wb.public.loan_repayments',
    kafka_group_name = 'clickhouse_loan_repayments_consumer',
    kafka_format = 'JSONAsString',
    kafka_num_consumers = 1;

CREATE TABLE IF NOT EXISTS worldbank.kafka_advisory_sessions (json String)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'wb.public.advisory_sessions',
    kafka_group_name = 'clickhouse_advisory_sessions_consumer',
    kafka_format = 'JSONAsString',
    kafka_num_consumers = 1;

CREATE TABLE IF NOT EXISTS worldbank.kafka_business_monthly_metrics (json String)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'wb.public.business_monthly_metrics',
    kafka_group_name = 'clickhouse_business_monthly_metrics_consumer',
    kafka_format = 'JSONAsString',
    kafka_num_consumers = 1;
