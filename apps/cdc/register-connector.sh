#!/bin/sh
set -e

CONNECT_URL="${KAFKA_CONNECT_URL:-http://kafka-connect:8083}"
CONFIG=/tmp/postgres-connector.json

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

# Rendered to a file rather than piped, so the POST below can read it back
# without the credentials ever appearing on a command line.
render_connector_config > "$CONFIG"

echo "Registering Postgres CDC source connector..."
RESPONSE=$(curl -s -w '\n%{http_code}' -X POST -H "Content-Type: application/json" \
  --data @"$CONFIG" "$CONNECT_URL/connectors")
STATUS=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Never echo the success body: Kafka Connect echoes the whole config back,
# database.password included, and container logs are readable by anyone with
# log access. Errors are safe to print — they describe the failure, not the
# credentials.
#
# Exit non-zero on failure. Without this the container exits 0 and a deploy
# reports success while CDC is dead — the failure mode this file just had.
case "$STATUS" in
  2*) echo "Connector registered (HTTP $STATUS)." ;;
  *)  echo "Connector registration FAILED (HTTP $STATUS): $(echo "$BODY" | head -c 400)" >&2
      exit 1 ;;
esac
