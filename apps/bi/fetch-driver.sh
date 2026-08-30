#!/usr/bin/env bash
# Downloads the ClickHouse driver Metabase needs into ./plugins.
#
# ClickHouse is a community driver, not bundled with Metabase, so this is a
# one-time prerequisite before the `bi` profile can connect to the warehouse.
# Driver and Metabase versions must be compatible — see the release notes at
# https://github.com/ClickHouse/metabase-clickhouse-driver/releases
#
# Usage:
#   ./fetch-driver.sh              # latest release
#   ./fetch-driver.sh 1.5.0        # a specific release tag
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p plugins

version="${1:-latest}"
if [ "$version" = "latest" ]; then
  url="https://github.com/ClickHouse/metabase-clickhouse-driver/releases/latest/download/clickhouse.metabase-driver.jar"
else
  url="https://github.com/ClickHouse/metabase-clickhouse-driver/releases/download/${version}/clickhouse.metabase-driver.jar"
fi

echo "Fetching ClickHouse driver (${version}) ..."
curl -fL --retry 3 -o plugins/clickhouse.metabase-driver.jar "$url"

# Metabase runs as a non-root user and needs to write into the plugins dir at
# startup to unpack its bundled drivers alongside this one.
chmod -R a+rwX plugins

echo "Done: $(ls -lh plugins/clickhouse.metabase-driver.jar | awk '{print $5}') at apps/bi/plugins/"
