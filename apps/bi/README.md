# bi

Optional self-service BI layer (Metabase) over the ClickHouse marts, for business
users who want to slice `mart_*` tables without writing SQL against ClickHouse
directly.

**It is defined but not running.** The service sits behind the Compose `bi`
profile, so `docker compose up` starts the platform exactly as before and never
touches Metabase. Bringing it up is a deliberate, documented opt-in.

## Why it is opt-in rather than part of the stack

- **Memory.** The reference environment is a ~4 GB Docker VM already running
  Kafka, ClickHouse and two Airflow processes. A second JVM pushes it over, and
  the first thing the OOM killer takes is ClickHouse — the database the
  dashboard is meant to read.
- **Not reproducible as code.** Metabase OSS has no file-based provisioning;
  dashboard export/import (serialization) is an enterprise feature. Its
  dashboards therefore cannot be version-controlled the way the Grafana
  dashboards in [`apps/observability`](../observability/README.md) are. Grafana
  stays the reproducible, ships-with-the-repo surface; Metabase is the ad-hoc
  exploration tool a non-engineer would actually be handed.

## Layout

```
fetch-driver.sh   One-time download of the ClickHouse community driver
plugins/          Where that driver jar lands (mounted into the container)
```

## Prerequisite: the ClickHouse driver

ClickHouse is not a bundled Metabase driver. Fetch it once:

```bash
./apps/bi/fetch-driver.sh
```

That writes `apps/bi/plugins/clickhouse.metabase-driver.jar`. Driver and
Metabase versions must be compatible — the Compose service pins Metabase to
`v0.50.21`; check the
[driver release notes](https://github.com/ClickHouse/metabase-clickhouse-driver/releases)
and pass an explicit tag (`./apps/bi/fetch-driver.sh 1.5.0`) if the latest
release has moved past that.

## Start / stop

```bash
docker compose --profile bi up -d metabase
```

Requires ClickHouse healthy (it is a `depends_on`, so the profile will start it
if needed). First boot takes 1–2 minutes while Metabase initialises its H2
application database. Then open http://localhost:3001 and complete the one-time
setup wizard (admin user, then "Add your data").

```bash
docker compose --profile bi stop metabase
```

Questions and dashboards persist in the `metabase-data` volume across restarts.

## Connection settings

In the wizard, or later under **Admin → Databases → Add database**:

| Field | Value |
|---|---|
| Database type | ClickHouse |
| Host | `clickhouse` (container DNS name — not `localhost`) |
| Port | `8123` (HTTP) |
| Username | `default` (`CLICKHOUSE_USER`) |
| Password | `clickhouse_pw` (`CLICKHOUSE_PASSWORD`) |
| Database name | `worldbank` (`CLICKHOUSE_DB`) |
| Use a secure connection (SSL) | off — the local broker speaks plain HTTP |

Metabase runs on the same Compose network as ClickHouse, so `clickhouse:8123`
resolves. Values come from `.env`; the table shows the defaults in
`.env.example`.

### Scripted alternative

To skip the "Add database" form (after the admin user exists), post it to the
API instead — useful if this is ever wired into a setup script:

```bash
curl -s -X POST http://localhost:3001/api/database \
  -H "Content-Type: application/json" \
  -H "X-Metabase-Session: $MB_SESSION_TOKEN" \
  -d '{"name":"ClickHouse (worldbank)","engine":"clickhouse",
       "details":{"host":"clickhouse","port":8123,"user":"default",
                  "password":"clickhouse_pw","dbname":"worldbank","ssl":false}}'
```

Get `MB_SESSION_TOKEN` from `POST /api/session` with the admin credentials.

## What to build on it

Metabase sees the dbt marts as ordinary tables, so most of this is point-and-click
under **New → Question**. The four that make a coherent first dashboard, with
their SQL equivalents:

**Program reach by country** — `mart_client_portfolio`

```sql
select country_iso3, clients_total, clients_active, women_share_pct,
       displaced_share_pct, jobs_supported
from worldbank.mart_client_portfolio
order by clients_total desc;
```

**Portfolio at risk trend** — `mart_loan_performance`

```sql
select disbursement_month, country_iso3, principal_disbursed_usd, par30_pct
from worldbank.mart_loan_performance
order by disbursement_month;
```

**Business revenue growth by sector** — `mart_business_growth`

```sql
select period, sector, avg_revenue_growth_pct, growing_share_pct, jobs_supported
from worldbank.mart_business_growth
order by period;
```

**Macro context** — `mart_country_indicators`

```sql
select year, country_name, indicator_name, value
from worldbank.mart_country_indicators
where indicator_code = 'NY.GDP.MKTP.KD.ZG'
order by year;
```

Save each question to a collection, then **New → Dashboard** and add them. Add a
country filter wired to `country_iso3` on the first three cards.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| ClickHouse missing from the database-type list | Driver jar absent or version-incompatible. Re-run `fetch-driver.sh`, then restart the container. |
| `Permission denied` on `/plugins` at startup | Metabase runs as a non-root user and unpacks bundled drivers into that directory. `chmod -R a+rwX apps/bi/plugins`. |
| Metabase or ClickHouse exits with code 137 | OOM kill — the VM is out of memory. Raise Docker's memory allocation, or stop `airflow-webserver` while exploring. |
| Connection refused to `clickhouse:8123` | ClickHouse is down. `docker compose ps clickhouse`, and check it is healthy before retrying. |
