#!/usr/bin/env bash
# Fetch the ClickHouse driver for Metabase.
#
# Metabase ships drivers for Postgres, MySQL and friends but not ClickHouse, so
# the community driver — maintained by ClickHouse themselves — is dropped into
# a plugins directory that the container mounts read-only.
#
# Source: https://github.com/ClickHouse/metabase-clickhouse-driver (official
# ClickHouse org). Pinned to a release compatible with Metabase v0.50.x.
set -euo pipefail

VERSION=${1:-1.50.7}
DIR=/var/www/production/metabase-plugins
JAR="$DIR/clickhouse.metabase-driver.jar"
URL="https://github.com/ClickHouse/metabase-clickhouse-driver/releases/download/${VERSION}/clickhouse.metabase-driver.jar"

install -d -o root -g root -m 755 "$DIR"

if [ -s "$JAR" ]; then
  echo "==> driver already present ($(stat -c%s "$JAR") bytes)"
else
  echo "==> downloading ${URL}"
  curl -fsSL --retry 3 -o "$JAR.tmp" "$URL"
  # A jar is a zip; if GitHub served an error page instead, this catches it
  # before Metabase silently starts without the driver.
  if ! unzip -tq "$JAR.tmp" >/dev/null 2>&1; then
    echo "!! downloaded file is not a valid jar" >&2
    head -c 200 "$JAR.tmp" >&2; echo >&2
    rm -f "$JAR.tmp"; exit 1
  fi
  mv "$JAR.tmp" "$JAR"
fi

chmod 644 "$JAR"
echo "==> $JAR ($(stat -c%s "$JAR") bytes)"
