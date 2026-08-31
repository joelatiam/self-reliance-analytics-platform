# bi / workspace

What lives inside Metabase: the questions worth building, the collection tree
that organises them, and two gotchas that cost time if you meet them cold.

Running Metabase at all — the driver, the Compose profile, the ClickHouse
connection — is in [`README.md`](README.md).

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

### Filing existing content

`setup-collections.sh` creates the shelves; questions and dashboards built before
it ran stay where they were. [`organize-content.py`](organize-content.py) files
them:

```bash
MB_URL=https://bi.example.com ./apps/bi/organize-content.py           # show the plan
MB_URL=https://bi.example.com ./apps/bi/organize-content.py --apply   # make the moves
```

A question's destination comes from the table it actually queries — resolved from
`source-table` for query-builder questions and by scanning the SQL for native
ones — not from its name, because names drift and the query does not. Staging
tables file with the mart they feed, so an ad-hoc question over `stg_loans` lands
with the lending marts.

A dashboard follows its cards: the collection most of them belong to, or the top
of the tree if it spans several. Anything whose source is unrecognised is listed
as skipped and left alone.

Dry run by default. Nothing moves until `--apply`.

## Dashboards

Metabase OSS cannot import dashboards — serialization is an enterprise feature —
so [`build-dashboards.py`](build-dashboards.py) is the closest thing to
dashboards-as-code the instance allows. The questions live in version control as
SQL under [`dashboards/`](dashboards), one JSON file per dashboard, and the
script replays them through the API.

```bash
MB_URL=https://bi.example.com ./apps/bi/build-dashboards.py           # show the plan
MB_URL=https://bi.example.com ./apps/bi/build-dashboards.py --apply   # build them
```

Four dashboards, sixteen questions, one per collection:

| Dashboard | Questions |
|---|---|
| Lending | PAR30 by disbursement month, principal disbursed, loan book by country, repayment punctuality |
| Program Reach | Clients mapped by country, inclusion shares, jobs supported, programme against country context |
| Business Growth | Revenue growth by sector, revenue and profit by month, share of businesses growing, jobs and customers |
| Country Context | GDP growth, displaced population hosted, displacement mapped, biggest year-on-year moves |

Idempotent by name within a collection: an existing card or dashboard is updated
in place rather than duplicated, so editing a spec and re-running edits the real
thing. Dashcards are replaced wholesale, which means the spec owns the layout —
a card removed from the JSON disappears from the dashboard.

SQL is unqualified, so it resolves to whichever database the Metabase connection
points at. The two map questions join `stg_countries` for ISO-2 codes, for the
reason in the section above.

### Editing a dashboard

Change the JSON and re-run with `--apply`. Changes made by clicking in Metabase
are *not* read back into the spec, so the two drift apart if you edit both — the
JSON wins on the next run.

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
