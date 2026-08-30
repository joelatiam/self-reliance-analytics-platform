#!/usr/bin/env bash
# Read-only inspection wrappers. These are what `reviewer` is allowed to sudo.
set -euo pipefail

cat > /usr/local/bin/app-status <<'STATUS'
#!/usr/bin/env bash
# Read-only overview of the box and everything running on it.
set -uo pipefail
hr() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

hr "host";      uptime; echo; free -h; echo; df -h / | tail -1
hr "nginx";     systemctl is-active nginx; ls -1 /etc/nginx/sites-enabled/
hr "pm2 (deploy)"
if [ -d /home/deploy/.pm2 ]; then
  runuser -u deploy -- pm2 list 2>/dev/null || echo "pm2 not running"
else
  echo "no pm2 apps yet"
fi
hr "containers"; docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || echo "none"
hr "apps in /var/www/production"
for d in /var/www/production/*/; do
  [ -d "$d" ] || continue
  printf '%-28s %s\n' "$(basename "$d")" \
    "$(git -C "$d" log -1 --format='%h %s (%cr)' 2>/dev/null || echo 'not a git checkout')"
done
STATUS

cat > /usr/local/bin/app-logs <<'LOGS'
#!/usr/bin/env bash
# app-logs <app> [lines] — read-only tail of an app's logs.
set -uo pipefail
app=${1:?usage: app-logs <app> [lines]}
lines=${2:-100}
[[ $app   =~ ^[a-zA-Z0-9_-]+$ ]] || { echo "bad app name" >&2; exit 2; }
[[ $lines =~ ^[0-9]{1,5}$     ]] || { echo "bad line count" >&2; exit 2; }

dir=/var/www/production/$app
echo "== pm2: $app"
runuser -u deploy -- pm2 logs "$app" --lines "$lines" --nostream 2>/dev/null \
  || echo "  (no pm2 process named $app)"

if [ -f "$dir/docker-compose.yml" ] || [ -f "$dir/compose.yaml" ]; then
  echo "== compose: $app"
  docker compose --project-directory "$dir" logs --tail "$lines" --no-color 2>/dev/null \
    || echo "  (compose not running)"
fi

echo "== nginx: $app"
tail -n "$lines" "/var/log/nginx/${app}.error.log" 2>/dev/null || echo "  (no vhost log)"
LOGS

chown root:root /usr/local/bin/app-status /usr/local/bin/app-logs
chmod 755       /usr/local/bin/app-status /usr/local/bin/app-logs

echo "==> helpers installed"
