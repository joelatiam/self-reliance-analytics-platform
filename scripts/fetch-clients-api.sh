#!/usr/bin/env bash
#
# Fetch data from the clients API, paging the way the pipeline does.
#
#   ./scripts/fetch-clients-api.sh                          # summary rollup
#   ./scripts/fetch-clients-api.sh clients                  # every client, paged
#   ./scripts/fetch-clients-api.sh loans 2026-08-30T20:00:00Z   # only what changed since
#   ./scripts/fetch-clients-api.sh --list                   # what you can ask for
#
# Rows are printed one JSON object per line, so it pipes into jq, grep or a file.
# The watermark to feed back into the next call is printed to stderr, which
# keeps stdout clean for redirection.
#
# Env: BASE_URL (default http://localhost:4000/api/v1), API_KEY, PAGE_SIZE.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000/api/v1}"
PAGE_SIZE="${PAGE_SIZE:-100}"
RESOURCE="${1:-summary}"
UPDATED_SINCE="${2:-}"

RESOURCES="clients businesses loans loan-repayments advisory-sessions business-metrics"
SINGLETONS="summary reference simulation/status"

if [ "$RESOURCE" = "--list" ] || [ "$RESOURCE" = "-l" ]; then
  echo "Paged:      $RESOURCES"
  echo "Single:     $SINGLETONS"
  exit 0
fi

# No array here on purpose: macOS still ships bash 3.2, where expanding an
# empty array under `set -u` is an unbound-variable error.
fetch() {
  if [ -n "${API_KEY:-}" ]; then
    curl -sS --fail-with-body -H "x-api-key: ${API_KEY}" "$1"
  else
    curl -sS --fail-with-body "$1"
  fi
}

# Endpoints that return a single object rather than a page of rows.
case " $SINGLETONS " in
  *" $RESOURCE "*)
    fetch "${BASE_URL}/${RESOURCE}" | python3 -m json.tool
    exit 0
    ;;
esac

case " $RESOURCES " in
  *" $RESOURCE "*) ;;
  *)
    echo "Unknown resource: $RESOURCE" >&2
    echo "Try: $RESOURCES $SINGLETONS" >&2
    exit 1
    ;;
esac

page=1
total_pages=1
max_updated="-"
watermark="$UPDATED_SINCE"

while [ "$page" -le "$total_pages" ]; do
  url="${BASE_URL}/${RESOURCE}?page=${page}&limit=${PAGE_SIZE}"
  [ -n "$watermark" ] && url="${url}&updatedSince=${watermark}"

  # Parse once: rows to stdout, paging state to a temp file for the loop.
  state=$(fetch "$url" | python3 -c '
import json, sys

payload = json.load(sys.stdin)
rows = payload.get("data", [])
meta = payload.get("meta", {})

for row in rows:
    print(json.dumps(row))

# Paging state goes to stderr so it cannot be mistaken for a data row.
print(
    meta.get("totalPages", 0),
    meta.get("total", 0),
    meta.get("maxUpdatedAt") or "-",
    file=sys.stderr,
)
' 2>&1 1>&3)

  read -r total_pages total max_updated <<<"$state"
  [ "$total_pages" -eq 0 ] && break

  echo "[page ${page}/${total_pages}] ${RESOURCE}: ${total} rows match" >&2
  page=$((page + 1))
done 3>&1

if [ "$max_updated" != "-" ] && [ -n "$max_updated" ]; then
  echo >&2
  echo "Next incremental pull:" >&2
  echo "  $0 ${RESOURCE} ${max_updated}" >&2
fi
