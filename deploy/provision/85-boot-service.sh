#!/usr/bin/env bash
# Bring the stack up at boot.
#
# The compose files already carry `restart: unless-stopped`, which covers the
# ordinary case: docker restarts and the containers it still knows about come
# back. This unit covers what that cannot — a boot after `docker compose down`,
# or after containers were removed — by running `up -d`, which recreates
# anything missing. Belt and braces, and it makes "does it survive a reboot?"
# a question with one answer instead of "it depends what state it was left in".
#
# The file list and the --profile flag must match deploy.sh exactly.
# --remove-orphans deletes any container of this Compose project the invocation
# does not define, and Metabase is behind the `bi` profile — so a unit that omits
# either the profile or compose.bi.yml tears the BI instance down on every boot.
set -euo pipefail

APP_DIR=${APP_DIR:-/var/www/production/self-reliance-analytics-platform}
UNIT=/etc/systemd/system/self-reliance-platform.service

cat > "$UNIT" <<SERVICE
[Unit]
Description=Self-Reliance Analytics Platform (docker compose)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${APP_DIR}
# Builds can take a while on a small box after an image prune.
TimeoutStartSec=1800
ExecStart=/usr/bin/docker compose --profile bi -f docker-compose.yml -f deploy/compose.prod.yml -f deploy/compose.bi.yml up -d --remove-orphans
ExecStop=/usr/bin/docker compose --profile bi -f docker-compose.yml -f deploy/compose.prod.yml -f deploy/compose.bi.yml stop

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable self-reliance-platform.service
echo "==> enabled: $(systemctl is-enabled self-reliance-platform.service)"
