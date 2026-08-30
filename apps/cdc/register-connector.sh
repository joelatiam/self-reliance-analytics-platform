#!/bin/sh
set -e

CONNECT_URL="${KAFKA_CONNECT_URL:-http://kafka-connect:8083}"

# The connector config is a template: Postgres credentials come from the same
# environment the postgres service is started with, so changing them in .env
# cannot leave CDC authenticating with stale hardcoded values. sed rather than
# envsubst, which the curl base image does not ship.
render_connector_config() {
  sed \
    -e "s|\${POSTGRES_HOST}|${POSTGRES_HOST:-postgres}|g" \
    -e "s|\${POSTGRES_PORT}|${POSTGRES_PORT:-5432}|g" \
    -e "s|\${POSTGRES_DB}|${POSTGRES_DB:-self_reliance}|g" \
    -e "s|\${POSTGRES_USER}|${POSTGRES_USER:-sr_app}|g" \
    -e "s|\${POSTGRES_PASSWORD}|${POSTGRES_PASSWORD:-sr_app_pw}|g" \
    debezium/postgres-connector.json
}

echo "Waiting for Kafka Connect REST API at $CONNECT_URL..."
until curl -sf "$CONNECT_URL/connectors" >/dev/null 2>&1; do
  sleep 3
done

if curl -sf "$CONNECT_URL/connectors/sr-postgres-source" >/dev/null 2>&1; then
  echo "Connector sr-postgres-source already registered, skipping."
  exit 0
fi

echo "Registering Postgres CDC source connector..."
curl -s -X POST -H "Content-Type: application/json" \
  --data "$(render_connector_config)" \
  "$CONNECT_URL/connectors"
echo
