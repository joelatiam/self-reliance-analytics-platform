#!/bin/sh
set -e

CONNECT_URL="${KAFKA_CONNECT_URL:-http://kafka-connect:8083}"

echo "Waiting for Kafka Connect REST API at $CONNECT_URL..."
until curl -sf "$CONNECT_URL/connectors" >/dev/null 2>&1; do
  sleep 3
done

if curl -sf "$CONNECT_URL/connectors/wb-postgres-source" >/dev/null 2>&1; then
  echo "Connector wb-postgres-source already registered, skipping."
  exit 0
fi

echo "Registering Postgres CDC source connector..."
curl -s -X POST -H "Content-Type: application/json" \
  --data @debezium/postgres-connector.json \
  "$CONNECT_URL/connectors"
echo
