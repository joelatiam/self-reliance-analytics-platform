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
fetch-driver.sh       One-time download of the ClickHouse community driver
setup-collections.sh  Creates the collection tree over the API (idempotent)
cleanup-sample-content.sh  Clears the Examples collection and Sample Database
plugins/              Where that driver jar lands (mounted into the container)
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
| Database name | `self_reliance` (`CLICKHOUSE_DB`) |
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
  -d '{"name":"ClickHouse (self_reliance)","engine":"clickhouse",
       "details":{"host":"clickhouse","port":8123,"user":"default",
                  "password":"clickhouse_pw","dbname":"self_reliance","ssl":false}}'
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
from self_reliance.mart_client_portfolio
order by clients_total desc;
```

**Portfolio at risk trend** — `mart_loan_performance`

```sql
select disbursement_month, country_iso3, principal_disbursed_usd, par30_pct
from self_reliance.mart_loan_performance
order by disbursement_month;
```

**Business revenue growth by sector** — `mart_business_growth`

```sql
select period, sector, avg_revenue_growth_pct, growing_share_pct, jobs_supported
from self_reliance.mart_business_growth
order by period;
```

**Macro context** — `mart_country_indicators`

```sql
select year, country_name, indicator_name, value
from self_reliance.mart_country_indicators
where indicator_code = 'NY.GDP.MKTP.KD.ZG'
order by year;
```

Save each question to a collection, then **New → Dashboard** and add them. Add a
country filter wired to `country_iso3` on the first three cards.

## Maps: the built-in world map keys on ISO-2

A region map that renders every country grey, with no values on hover, while the
legend shows real numbers is not a data problem — it is a code-format mismatch.
Metabase's built-in world map matches regions on **two-letter ISO 3166-1 alpha-2**
codes. Every country-grain mart here is keyed on `country_iso3` (`RWA`, `KEN`,
`ETH`, `SSD`, `TCD`), which matches no region, so nothing gets shaded and there is
nothing to hover.

Cheapest fix first:

1. **Project to ISO-2 in the question.** `stg_countries` carries both codes:

   ```sql
   select c.iso2_code as country, count(*) as loans
   from self_reliance.stg_loans l
   inner join self_reliance.stg_countries c on l.country_iso3 = c.iso3_code
   group by c.iso2_code
   ```

2. **Use a mart that is already ISO-2.** `mart_country_indicators.country_code`
   comes from the World Bank feed in alpha-2, so maps over it work untouched.

3. **Upload a custom map keyed on ISO-3.** Admin → Maps → Add a map, pointing at
   a world GeoJSON whose region identifier is `ISO_A3`. One-time cost, after
   which every `country_iso3` column maps directly.

Whichever route, set the column's semantic type to **Country** under
Admin → Table Metadata, or Metabase will not offer it as a region field.

The durable version of (1) is a dbt change: add `country_iso2` to the
country-grain marts by joining `stg_countries`, and every map question works with
no SQL. That is a marts contract change, so it belongs in its own PR.

## Collections

Run [`setup-collections.sh`](setup-collections.sh) to create the navigation tree.
It is idempotent, so re-running it after adding a group is safe:

```bash
./apps/bi/setup-collections.sh
```

It prompts for the URL and login, or takes `MB_URL` and `MB_SESSION` from the
environment for a non-interactive run. The password is read straight into the
session call — never echoed, stored or exported.

The tree mirrors the mart families, so a question's home is obvious from the
table it came from:

```
Self-Reliance Analytics
├── Program Reach      mart_client_portfolio, mart_country_program_context
├── Lending            mart_loan_performance, mart_repayment_performance
├── Business Growth    mart_business_growth
└── Country Context    mart_country_indicators, mart_country_refugee_stats,
                       mart_indicator_yoy_growth
```

Collections are the one part of the Metabase workspace that *is* reproducible —
they are plain API objects, unlike the dashboards.

## Turning off the sample content

Metabase seeds an "Examples" collection and a Sample Database on first boot.
`MB_LOAD_SAMPLE_CONTENT: "false"` is set in both Compose files, which keeps a
fresh instance clean.

It does **not** retroactively clean an instance that already created them — the
flag is only read when the application database is initialised. Clear an existing
instance once with:

```bash
./apps/bi/cleanup-sample-content.sh
```

It trashes the Examples collection and removes the Sample Database, prompting
before each (pass `--yes` to skip the prompts). Removing the Sample Database also
drops any question built on it, which is why it asks.

By hand, if you would rather: open the Examples collection → Move to trash, then
Admin → Databases → Sample Database → Remove.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| ClickHouse missing from the database-type list | Driver jar absent or version-incompatible. Re-run `fetch-driver.sh`, then restart the container. |
| `Permission denied` on `/plugins` at startup | Metabase runs as a non-root user and unpacks bundled drivers into that directory. `chmod -R a+rwX apps/bi/plugins`. |
| Metabase or ClickHouse exits with code 137 | OOM kill — the VM is out of memory. Raise Docker's memory allocation, or stop `airflow-webserver` while exploring. |
| Map is all grey, legend has values, nothing on hover | The region column is ISO-3; the built-in world map wants ISO-2. See [Maps](#maps-the-built-in-world-map-keys-on-iso-2). |
| Connection refused to `clickhouse:8123` | ClickHouse is down. `docker compose ps clickhouse`, and check it is healthy before retrying. |
