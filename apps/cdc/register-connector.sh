#!/bin/sh
set -e

CONNECT_URL="${KAFKA_CONNECT_URL:-http://kafka-connect:8083}"
CONFIG=/tmp/postgres-connector.json

echo "Waiting for Kafka Connect REST API at $CONNECT_URL..."
until curl -sf "$CONNECT_URL/connectors" >/dev/null 2>&1; do
  sleep 3
done

if curl -sf "$CONNECT_URL/connectors/wb-postgres-source" >/dev/null 2>&1; then
  echo "Connector wb-postgres-source already registered, skipping."
  exit 0
fi

# The checked-in JSON carries the local defaults so it stays runnable by hand.
# Anywhere with real credentials (any deployed environment) passes them in as
# env vars, so they are substituted here rather than baked into the image.
sed -e "s|\"database.user\": \".*\"|\"database.user\": \"${POSTGRES_USER:-wb_app}\"|" \
    -e "s|\"database.password\": \".*\"|\"database.password\": \"${POSTGRES_PASSWORD:-wb_app_pw}\"|" \
    -e "s|\"database.dbname\": \".*\"|\"database.dbname\": \"${POSTGRES_DB:-worldbank}\"|" \
    debezium/postgres-connector.json > "$CONFIG"

echo "Registering Postgres CDC source connector..."
RESPONSE=$(curl -s -w '\n%{http_code}' -X POST -H "Content-Type: application/json" \
  --data @"$CONFIG" "$CONNECT_URL/connectors")
STATUS=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "$BODY"

# Exit non-zero on failure. Without this the container exits 0 and a deploy
# reports success while CDC is dead — the failure mode this file just had.
case "$STATUS" in
  2*) echo "Connector registered (HTTP $STATUS)." ;;
  *)  echo "Connector registration FAILED (HTTP $STATUS)." >&2; exit 1 ;;
esac
