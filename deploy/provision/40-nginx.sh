#!/usr/bin/env bash
# nginx: shared proxy snippet, friendly "unavailable" page, catch-all default,
# and the app-site helper that scaffolds one vhost per subdomain.
set -euo pipefail

DOMAIN=${DOMAIN:-example.com}
ERR_ROOT=/var/www/errors

echo "==> nginx can traverse the app root (static sites)"
setfacl -R -m u:www-data:rX -m d:u:www-data:rX /var/www/production

echo "==> unavailable page"
install -d -o root -g root -m 755 "$ERR_ROOT"
install -m 644 "$(dirname "$0")/nginx/unavailable.html" "$ERR_ROOT/unavailable.html"

# `Connection: upgrade` was previously set unconditionally, on every request and
# not just WebSocket ones. That header tells nginx the connection is single-use,
# so no proxied request could reuse a connection to the upstream — every API call
# to Metabase, Airflow and Grafana paid a fresh TCP handshake. The map sends
# `close` when the client did not ask for an upgrade, which is the ordinary case.
echo "==> upgrade map (http context, so it must live in conf.d)"
cat > /etc/nginx/conf.d/upgrade-map.conf <<'MAP'
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
MAP

echo "==> shared proxy snippet"
cat > /etc/nginx/snippets/app-proxy.conf <<'SNIP'
proxy_http_version 1.1;
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Upgrade           $http_upgrade;
proxy_set_header Connection        $connection_upgrade;
proxy_read_timeout 300s;
proxy_connect_timeout 15s;
SNIP

# proxy_intercept_errors stays OFF on purpose: we want to catch nginx's own
# "cannot reach upstream" 502/504, not swallow a 502 the application itself
# returned. Masking real app errors behind a friendly page would hide bugs.
cat > /etc/nginx/snippets/app-errors.conf <<'SNIP'
error_page 502 503 504 /_unavailable.html;

location = /_unavailable.html {
    root /var/www/errors;
    rewrite ^ /unavailable.html break;
    internal;
}
SNIP

echo "==> catch-all default: unknown hosts get the unavailable page, not a hang"
rm -f /etc/nginx/sites-enabled/default
cat > /etc/nginx/sites-available/000-catchall.conf <<'CATCH'
# Wildcard DNS means any unconfigured subdomain lands here. Serving the
# unavailable page beats dropping the connection: a reviewer hitting a typo'd
# or not-yet-deployed address sees an explanation instead of a browser timeout.
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/errors;
    location = /unavailable.html { internal; }
    location / { return 503; }
    error_page 503 /unavailable.html;
}
CATCH
ln -sf /etc/nginx/sites-available/000-catchall.conf /etc/nginx/sites-enabled/

install -m 755 "$(dirname "$0")/app-site" /usr/local/bin/app-site

nginx -t && systemctl reload nginx
echo "==> nginx done (domain: ${DOMAIN})"
