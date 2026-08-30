# cdc

Change data capture: streams row-level changes from Postgres into Kafka via Debezium, so ClickHouse can consume them in near real time instead of via batch reloads.

## Layout

```
debezium/
  postgres-connector.json   Debezium Postgres source connector config
register-connector.sh        Waits for Kafka Connect, then POSTs the config
Dockerfile                    Builds the one-shot connector-init image
```

## How it works

1. `connector-init` (in `docker-compose.yml`) waits for Kafka Connect's REST API to be healthy.
2. It POSTs `debezium/postgres-connector.json` to `http://kafka-connect:8083/connectors`, registering the connector.
3. Debezium uses PostgreSQL logical replication (`pgoutput` plugin) to stream row changes to Kafka topics named `wb.public.<table>`, for:
   - the country aggregates: `public.countries`, `public.indicators`, `public.observations`, `public.refugee_statistics`
   - the operational client activity: `public.clients`, `public.businesses`, `public.loans`, `public.loan_repayments`, `public.advisory_sessions`, `public.business_monthly_metrics`

`decimal.handling.mode` is set to `double`. Debezium's default (`precise`) sends `NUMERIC` as base64-encoded bytes, which every money column in the client-activity tables would then have to decode in ClickHouse; `double` sends a plain number instead. The trade is exact-decimal fidelity for legibility, which is the right way round for reporting figures already rounded to cents.

Adding a new replicated table means updating `table.include.list` in `postgres-connector.json` **and rebuilding the image** (`docker compose up -d --build connector-init`) — the config is baked in at build time, so a plain `up` without `--build` will silently keep using the old one.

## Check it

```bash
curl http://localhost:8083/connectors/wb-postgres-source/status
```

See [`apps/warehouse`](../warehouse/README.md) for how these Kafka topics get consumed into ClickHouse.
