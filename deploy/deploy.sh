#!/usr/bin/env bash
# Server-side deploy. Run as the `deploy` user, either by GitHub Actions on a
# merge to production, or by hand: /var/www/production/<app>/deploy/deploy.sh
#
# Idempotent and safe to re-run. Takes an flock so two merges landing close
# together queue instead of fighting over the same checkout.
set -euo pipefail

APP_DIR=${APP_DIR:-/var/www/production/self-reliance-analytics-platform}
BRANCH=${BRANCH:-production}
# The BI profile and its override file are both required, not optional. Metabase
# is defined in docker-compose.yml behind `profiles: ["bi"]`, and a Compose
# invocation that does not select that profile leaves the service out of the
# project entirely — at which point `up -d --remove-orphans` below reads a
# running sr-metabase as an orphan and removes it. That is why a BI instance
# brought up by hand survived only until the next deploy.
COMPOSE=(docker compose
  --profile bi
  -f docker-compose.yml
  -f deploy/compose.prod.yml
  -f deploy/compose.bi.yml)

exec 9>/tmp/deploy-self-reliance.lock
flock -w 900 9 || { echo "another deploy is running; gave up after 15m"; exit 1; }

cd "$APP_DIR"

echo "==> fetching $BRANCH"
git fetch --quiet origin "$BRANCH"
BEFORE=$(git rev-parse HEAD)
# Hard reset: this checkout is a deploy artefact, not a workspace. Untracked
# files (notably .env) are left alone — no git clean here, by design.
git reset --quiet --hard "origin/$BRANCH"
AFTER=$(git rev-parse HEAD)
echo "    $(git log -1 --format='%h %s')"
[ "$BEFORE" = "$AFTER" ] && echo "    (no new commits — redeploying anyway)"

if [ ! -f .env ]; then
  echo "!! .env is missing. Run deploy/init-env.sh once as root." >&2
  exit 1
fi

# Metabase mounts its ClickHouse driver from outside the checkout, because a jar
# inside it is at the mercy of the hard reset above. Checked here because the
# failure is otherwise silent and looks like a healthy deploy: Metabase starts
# happily with no driver, /api/health returns 200, the wait below passes, and
# every question against the warehouse breaks with no obvious reason why.
METABASE_PLUGINS=/var/www/production/metabase-plugins
if ! compgen -G "$METABASE_PLUGINS/*.jar" >/dev/null; then
  echo "!! no driver jar in $METABASE_PLUGINS" >&2
  echo "   Metabase would start without ClickHouse and report itself healthy." >&2
  echo "   Fix: sudo deploy/provision/86-metabase-driver.sh" >&2
  exit 1
fi

# --- one-time migration to the self-reliance names ---------------------------
# The databases and the Postgres role were renamed (worldbank -> self_reliance,
# wb_app -> sr_app). Two things follow that a plain redeploy cannot handle:
# .env is untracked and so survives `git reset --hard` with the old values in
# it, and Postgres will not create a database inside an existing data
# directory. Deploying onto the old volumes therefore fails every health check
# rather than failing loudly.
#
# Order matters here. The volumes are dropped only after the rewritten .env has
# been read back and confirmed, and the stamp is written only after both have
# succeeded -- so a failed rewrite can never leave the host with its data
# destroyed, its config stale, and the migration marked done.
#
# The stamp is written on a fresh host too, where there is nothing to migrate,
# so a later deploy never mistakes ordinary volumes for legacy ones. It lives
# outside git alongside .env, for the same reason .env survives: this checkout
# is reset on every deploy but never cleaned.
MIGRATION_STAMP=.deploy-state/renamed-to-self-reliance

if [ ! -f "$MIGRATION_STAMP" ]; then
  mkdir -p "$(dirname "$MIGRATION_STAMP")"

  if grep -qE '^(POSTGRES_DB=worldbank|POSTGRES_USER=wb_app|CLICKHOUSE_DB=worldbank)$' .env; then
    echo "==> migrating .env to the self-reliance names"
    cp .env ".env.bak.$(date +%Y%m%d%H%M%S)"

    # Write via a temp file rather than `sed -i`, whose in-place flag differs
    # between GNU and BSD sed, and which fails *after* truncating on the wrong
    # one.
    if sed -e 's/^POSTGRES_DB=worldbank$/POSTGRES_DB=self_reliance/' \
           -e 's/^POSTGRES_USER=wb_app$/POSTGRES_USER=sr_app/' \
           -e 's/^CLICKHOUSE_DB=worldbank$/CLICKHOUSE_DB=self_reliance/' \
           .env > .env.migrating; then
      mv .env.migrating .env
    else
      # The original is still untouched on this path, so say so plainly.
      rm -f .env.migrating
      echo "!! could not rewrite .env; it is unchanged and nothing was dropped" >&2
      exit 1
    fi

    # Read it back. Nothing destructive happens until this passes.
    if grep -qE '^(POSTGRES_DB=worldbank|POSTGRES_USER=wb_app|CLICKHOUSE_DB=worldbank)$' .env ||
       ! grep -q '^POSTGRES_DB=self_reliance$' .env ||
       ! grep -q '^POSTGRES_USER=sr_app$' .env ||
       ! grep -q '^CLICKHOUSE_DB=self_reliance$' .env; then
      echo "!! .env rewrite did not take; leaving volumes and stamp alone" >&2
      echo "   restore from the .env.bak.* beside it and investigate" >&2
      exit 1
    fi

    echo "==> dropping volumes created under the old names"
    echo "    every row is re-fetched from the World Bank and UNHCR APIs and"
    echo "    regenerated by the clients API on the next DAG run"
    "${COMPOSE[@]}" down -v --remove-orphans || true
  fi

  touch "$MIGRATION_STAMP"
fi

echo "==> building changed images"
"${COMPOSE[@]}" build --pull

echo "==> starting stack"
"${COMPOSE[@]}" up -d --remove-orphans

# `--wait` counts a container that exits as a failure, so the one-shots cannot be
# part of the gate: connector-init registers the Debezium connector and stops,
# airflow-init migrates the Airflow DB and stops. Including them made a healthy
# deploy report failure the moment connector-init finished — the wait returned in
# ~90s of a 420s budget, while Airflow was still legitimately starting. They are
# checked by exit code below instead, which is what actually matters for them.
ONE_SHOT=(connector-init airflow-init)
WAIT_FOR=()
while read -r service; do
  case " ${ONE_SHOT[*]} " in *" $service "*) continue ;; esac
  WAIT_FOR+=("$service")
done < <("${COMPOSE[@]}" config --services)

echo "==> waiting for ${#WAIT_FOR[@]} long-running services"
"${COMPOSE[@]}" up -d --no-recreate --wait --wait-timeout 420 "${WAIT_FOR[@]}" || {
  echo "!! some services did not become healthy:" >&2
  "${COMPOSE[@]}" ps >&2
  exit 1
}

# A one-shot that failed is a real failure — it just is not a health failure.
for service in "${ONE_SHOT[@]}"; do
  container=$("${COMPOSE[@]}" ps -aq "$service" 2>/dev/null | head -1)
  [ -n "$container" ] || continue
  read -r state code < <(docker inspect -f '{{.State.Status}} {{.State.ExitCode}}' "$container")
  if [ "$state" = "exited" ] && [ "$code" != "0" ]; then
    echo "!! $service exited $code" >&2
    "${COMPOSE[@]}" logs --tail 40 "$service" >&2
    exit 1
  fi
done

echo "==> reclaiming disk"
docker image prune -f >/dev/null
docker builder prune -f --filter 'until=168h' >/dev/null

echo "==> deployed"
"${COMPOSE[@]}" ps --format 'table {{.Service}}\t{{.Status}}'
free -h | sed -n '1,2p'
