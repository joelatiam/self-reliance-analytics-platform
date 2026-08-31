#!/usr/bin/env bash
# Creates the collection tree that organises the BI content, via the Metabase API.
#
# Metabase OSS has no dashboards-as-code, but collections are plain API objects,
# so at least the *shape* of the workspace is reproducible: run this against a
# fresh instance and the navigation comes out the same every time.
#
# Idempotent — a collection that already exists at the right place is left alone,
# so it is safe to re-run after adding a new group.
#
# Usage:
#   ./setup-collections.sh                          # prompts for URL + login
#   MB_URL=https://bi.example.com ./setup-collections.sh
#   MB_SESSION=<token> MB_URL=... ./setup-collections.sh   # non-interactive
set -euo pipefail

MB_URL="${MB_URL:-}"
if [ -z "$MB_URL" ]; then
  read -r -p "Metabase URL (e.g. https://bi.example.com): " MB_URL
fi
MB_URL="${MB_URL%/}"

# The password is read straight into the session call and never echoed, stored
# or exported. Pass MB_SESSION instead to keep credentials out of this script.
if [ -z "${MB_SESSION:-}" ]; then
  read -r -p "Email: " MB_EMAIL
  read -r -s -p "Password: " MB_PASSWORD; echo
  MB_SESSION=$(curl -sf -X POST "$MB_URL/api/session" \
    -H 'Content-Type: application/json' \
    -d "$(printf '{"username":%s,"password":%s}' \
          "$(printf '%s' "$MB_EMAIL" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" \
          "$(printf '%s' "$MB_PASSWORD" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
  unset MB_PASSWORD
fi

api() {  # api <method> <path> [body]
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sf -X "$method" "$MB_URL/api$path" \
      -H 'Content-Type: application/json' -H "X-Metabase-Session: $MB_SESSION" -d "$body"
  else
    curl -sf -X "$method" "$MB_URL/api$path" -H "X-Metabase-Session: $MB_SESSION"
  fi
}

existing_json=$(api GET /collection)

# ensure <name> <description> [parent_id] -> prints the collection id
ensure() {
  local name="$1" desc="$2" parent="${3:-}"
  local found
  found=$(printf '%s' "$existing_json" | NAME="$name" PARENT="$parent" python3 -c '
import json, os, sys
name, parent = os.environ["NAME"], os.environ["PARENT"] or None
for c in json.load(sys.stdin):
    if c.get("name") == name and str(c.get("parent_id") or "") == (parent or ""):
        print(c["id"]); break
')
  if [ -n "$found" ]; then
    echo "  = $name (exists, id $found)" >&2
    printf '%s' "$found"
    return
  fi
  local body
  body=$(NAME="$name" DESC="$desc" PARENT="$parent" python3 -c '
import json, os
b = {"name": os.environ["NAME"], "description": os.environ["DESC"]}
if os.environ["PARENT"]:
    b["parent_id"] = int(os.environ["PARENT"])
print(json.dumps(b))
')
  local id
  id=$(api POST /collection "$body" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
  echo "  + $name (created, id $id)" >&2
  printf '%s' "$id"
}

echo "Creating collections on $MB_URL ..." >&2

root=$(ensure "Self-Reliance Analytics" \
  "Business analytics over the ClickHouse marts. Pipeline health lives in Grafana, not here.")

# One sub-collection per mart family, so a question's home is obvious from the
# table it came from.
ensure "Program Reach"    "Who the programme reaches: caseload, demographics, country context. Sources: mart_client_portfolio, mart_country_program_context." "$root" >/dev/null
ensure "Lending"          "Loan book and repayment behaviour, PAR30 at the usual microfinance convention. Sources: mart_loan_performance, mart_repayment_performance." "$root" >/dev/null
ensure "Business Growth"  "Business revenue, profit and jobs by sector and month. Source: mart_business_growth." "$root" >/dev/null
ensure "Country Context"  "Macro backdrop from the World Bank and UNHCR feeds. Sources: mart_country_indicators, mart_country_refugee_stats, mart_indicator_yoy_growth." "$root" >/dev/null

echo "Done. Open $MB_URL/collection/$root" >&2
