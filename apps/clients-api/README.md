# Self-Reliance Clients API

A simulated **source system**, not part of the pipeline itself.

The program this stands in for invests in displacement-affected communities
across Rwanda, Kenya, Ethiopia, South Sudan and Chad — financing, advisory and
market access for refugee and host-community entrepreneurs. This service plays
the part of the operational system such a program would run on: it holds the
clients, the businesses they operate, the loans they take and repay, and the
coaching they receive, and it keeps generating new activity on a schedule so
the analytics pipeline has a live, changing source to pull from.

Everything in it is generated. No real person's data is involved, and phone
numbers are masked by construction so nothing dialable is ever produced.

## How it fits the pipeline

```
clients-api  ──writes on :05 :15 :25 :35 :45 :55──►  its own Postgres
     │
     │  REST + Swagger, incremental via ?updatedSince=
     ▼
ingestion (Airflow, every :00 :10 :20 :30 :40 :50) ──► pipeline Postgres ──► Debezium ──► ClickHouse ──► dbt
```

The simulator writes five minutes into each ten-minute window and the pipeline
pulls on the boundary, so every fetch reads data that settled five minutes
earlier and no pull can ever race a half-written tick.

## Running it

Under docker compose from the repo root it comes up with everything else:

```bash
docker compose up -d clients-api
```

Standalone:

```bash
cp .env.example .env   # point DATABASE_* at a Postgres you control
npm install
npm run start:dev
```

| What | Where |
|---|---|
| Swagger UI | http://localhost:4000/docs |
| OpenAPI JSON | http://localhost:4000/docs-json |
| Health | http://localhost:4000/health |
| API root | http://localhost:4000/api/v1 |

Auth is off while `API_KEY` is empty. Set it and every request needs an
`x-api-key` header; Swagger has an **Authorize** button for it.

## The data

| Table | One row is | Notable fields |
|---|---|---|
| `clients` | An enrolled entrepreneur | displacement status, country of origin, camp or settlement, gender, youth flag, household size, cohort, advisor |
| `businesses` | The enterprise they run | sector and sub-sector, stage, registration, market access, headcount split by gender and displacement, revenue vs. the baseline captured at enrolment |
| `loans` | A below-market loan | cycle, principal in local currency and USD, rate, term, purpose, risk grade, outstanding balance, days past due |
| `loan_repayments` | One installment | amount, due date, days late, on-time flag, payment method |
| `advisory_sessions` | A coaching or training touchpoint | type, topic, language delivered in, attendance, satisfaction |
| `business_monthly_metrics` | A business's month | revenue, profit, headcount, customers served, growth against baseline |
| `activity_ticks` | One simulation run | what each tick created, for reconciliation |

Every table carries `updated_at`, which is what makes incremental pulls work.

### Why the numbers look like they do

The generator is shaped by how the caseload actually looks, not by uniform
randomness:

- **Countries are weighted by hosted displaced population.** Chad and Ethiopia
  dominate; Rwanda is roughly 3% of the dataset. See
  [`refugee-populations.ts`](src/modules/clients/constants/refugee-populations.ts).
- **Nationalities follow the real origin mix per host country** — Sudanese in
  Chad, Somalis and South Sudanese in Kenya, Congolese and Burundians in
  Rwanda. Nobody is given a nationality that country does not host.
- **Names come from regional pools** tied to that origin, so a Somali client in
  Kakuma does not end up with a Congolese surname.
- **Demographics** skew ~58% women and ~57% youth, matching the reported
  reported split.
- **Repayment** runs ~93% on time by default, with arrears ageing into a small
  default tail — the below-market lending model only makes sense at a high
  repayment rate.
- **Revenue grows faster for businesses holding capital**, which is the whole
  premise of the financing pillar, with occasional bad months.

## Generating data

### Bulk: hundreds of thousands of rows

Sized in **rows**, because that is the thing you actually want to ask for:

```bash
npm run seed:caseload -- --records=500000 --truncate
```

```bash
npm run seed:caseload -- --records=1000000 --truncate --seed=42
```

| Flag | Meaning |
|---|---|
| `--records=N` | Stop after exactly N rows across all tables |
| `--clients=N` | Generate N clients instead of targeting a row count |
| `--country=TCD` | Restrict to one country (ISO3 or ISO2) |
| `--truncate` | Wipe existing data first |
| `--seed=42` | Reproducible output |

Rows are written with chunked bulk inserts rather than per-entity ORM saves,
which is what keeps a million rows to a couple of minutes. Countries are drawn
from proportionally on every batch, so stopping early still leaves a
representative mix rather than whichever country came first.

### Test mode: never more than 100 rows

```bash
SIMULATION_MODE=test npm run seed:caseload -- --records=1000000
```

Test mode caps **every** generation path — the bulk script, the seed endpoint
and the boot seed — at 100 rows total, whatever was asked for. `NODE_ENV=test`
turns it on as well. This is what keeps CI and local smoke runs from building a
real dataset by accident.

### Through Swagger

- `POST /api/v1/simulation/seed` — bulk-enrol a caseload (subject to the same cap)
- `POST /api/v1/simulation/tick` — run one round of activity now; `intensity`
  multiplies the volume, `country` narrows it
- `POST /api/v1/clients`, `/businesses`, `/loans`, `/advisory-sessions` — add a
  specific record by hand; anything you leave out is generated from that
  country's distributions
- `GET /api/v1/simulation/status` — schedule, next tick, last tick's counts, row totals
- `GET /api/v1/summary` — portfolio rollup: demographics, jobs, revenue growth,
  disbursed and outstanding capital, on-time repayment rate, portfolio at risk
- `GET /api/v1/reference` — every valid country, location, language and sector

## Reading it incrementally

Each list endpoint orders by `(updated_at, id)` ascending and returns both the
highest `updated_at` it saw and a cursor pointing at the last row:

```bash
curl "http://localhost:4000/api/v1/loans?limit=500"
# → { "data": [...], "meta": { ...,
#      "maxUpdatedAt": "2026-08-30T10:25:00.512Z",
#      "nextCursor":  "MjAyNi0wOC0zMFQxMDoyNTowMC41MTJafDE0OTIy" } }
```

**Within a run, follow `nextCursor` until it comes back null:**

```bash
curl "http://localhost:4000/api/v1/loans?limit=500&cursor=MjAyNi0wOC0zMFQxMDoyNTowMC41MTJafDE0OTIy"
```

Do not walk this API with `page=2,3,4...`. The simulator is writing while you
read, and under OFFSET paging a row updated mid-walk moves to the end of the
`updated_at` ordering, shifting an unread row backwards into a page you already
consumed. That row is then never collected, because the watermark advances past
its timestamp. The cursor pins each page to the last row's sort key, so
concurrent writes cannot move rows out of the walk. `page` still works for
Swagger and for browsing by hand.

**Between runs, feed `maxUpdatedAt` back as `updatedSince`** and you get only
what changed. That is exactly what the ingestion app does, storing the
watermark per resource between runs.

## Layout

```
src/
  config/                   app, database and simulation config
  database/                 TypeORM setup
  dto/                      shared pagination and response DTOs
  modules/
    auth/                   x-api-key guard
    clients/
      constants/            countries, camps, sectors, name pools, population shares
      dto/                  request and query DTOs
      entities/             the seven tables
      helpers/              generators, schedule, record budget, formatting
      services/             query, generator, activity (tick), sequence
      swagger/              operation and example definitions
    orchestration/          the cron that fires the tick
  scripts/                  bulk caseload generator
```

## Tests

```bash
npm test
```

Covers the tick schedule (including that it never lands on a pipeline fetch
minute), the population split, the test-mode cap and the money/date formatting.
