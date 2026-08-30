#!/usr/bin/env bash
# Server-side deploy. Run as the `deploy` user, either by GitHub Actions on a
# merge to main, or by hand: /var/www/production/<app>/deploy/deploy.sh
#
# Idempotent and safe to re-run. Takes an flock so two merges landing close
# together queue instead of fighting over the same checkout.
set -euo pipefail

APP_DIR=${APP_DIR:-/var/www/production/self-reliance-analytics-platform}
BRANCH=${BRANCH:-main}
COMPOSE=(docker compose -f docker-compose.yml -f deploy/compose.prod.yml)

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

echo "==> building changed images"
"${COMPOSE[@]}" build --pull

echo "==> starting stack"
"${COMPOSE[@]}" up -d --remove-orphans --wait --wait-timeout 420 || {
  echo "!! some services did not become healthy:" >&2
  "${COMPOSE[@]}" ps >&2
  exit 1
}

echo "==> reclaiming disk"
docker image prune -f >/dev/null
docker builder prune -f --filter 'until=168h' >/dev/null

echo "==> deployed"
"${COMPOSE[@]}" ps --format 'table {{.Service}}\t{{.Status}}'
free -h | sed -n '1,2p'
