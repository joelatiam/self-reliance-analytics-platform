#!/usr/bin/env bash
# Removes the Examples collection and the Sample Database from a running Metabase.
#
# MB_LOAD_SAMPLE_CONTENT=false only stops them being *created*; it is read when
# the application database is initialised and never again. An instance that was
# first booted without the flag keeps its demo content forever, so it has to be
# cleared once — this does that.
#
# Destructive: the Sample Database removal also drops any question built on it.
# Prompts before touching anything unless --yes is passed.
#
# Usage:
#   ./cleanup-sample-content.sh                     # prompts for URL + login
#   MB_URL=https://bi.example.com ./cleanup-sample-content.sh --yes
#   MB_SESSION=<token> MB_URL=... ./cleanup-sample-content.sh
set -euo pipefail

ASSUME_YES=false
[ "${1:-}" = "--yes" ] && ASSUME_YES=true

MB_URL="${MB_URL:-}"
if [ -z "$MB_URL" ]; then
  read -r -p "Metabase URL (e.g. https://bi.example.com): " MB_URL
fi
MB_URL="${MB_URL%/}"

# The password goes straight into the session call — never echoed, stored or
# exported. Pass MB_SESSION instead to keep credentials out of this script.
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

confirm() {  # confirm <prompt>
  $ASSUME_YES && return 0
  local reply
  read -r -p "$1 [y/N] " reply
  [ "$reply" = "y" ] || [ "$reply" = "Y" ]
}

# --- Examples collection -----------------------------------------------------
# Matched by name: Metabase marks it is_sample only in some versions, so the
# name is the reliable handle. Archiving moves it to the trash, which is where
# the UI's "Move to trash" puts it too.
examples_id=$(api GET /collection | python3 -c '
import json, sys
for c in json.load(sys.stdin):
    if c.get("name") == "Examples" and not c.get("archived"):
        print(c["id"]); break
')

if [ -z "$examples_id" ]; then
  echo "Examples collection: not present (nothing to do)"
else
  if confirm "Move the \"Examples\" collection (id $examples_id) to trash?"; then
    api PUT "/collection/$examples_id" '{"archived":true}' >/dev/null
    echo "Examples collection: trashed (id $examples_id)"
  else
    echo "Examples collection: skipped"
  fi
fi

# --- Sample Database ---------------------------------------------------------
sample_db=$(api GET /database | python3 -c '
import json, sys
d = json.load(sys.stdin)
for db in (d.get("data") if isinstance(d, dict) else d):
    if db.get("is_sample") or db.get("name") == "Sample Database":
        print("%s\t%s" % (db["id"], db["name"])); break
')

if [ -z "$sample_db" ]; then
  echo "Sample Database: not present (nothing to do)"
else
  db_id=${sample_db%%$'\t'*}; db_name=${sample_db#*$'\t'}
  echo "Sample Database: found \"$db_name\" (id $db_id)"
  if confirm "Remove it? This also drops every question built on it."; then
    api DELETE "/database/$db_id" >/dev/null
    echo "Sample Database: removed (id $db_id)"
  else
    echo "Sample Database: skipped"
  fi
fi

echo
echo "Trashed collections stay recoverable until the trash is emptied, which the"
echo "UI does under Trash -> empty. Nothing else was touched."
