#!/usr/bin/env bash
# The apex (and www) serve a small static contact page. Loaded before the
# catch-all by filename order, and matched ahead of it anyway because nginx
# prefers an exact server_name over the default_server.
set -euo pipefail

DOMAIN=${DOMAIN:-joelatiam.com}
ROOT=/var/www/landing

echo "==> landing page"
install -d -o root -g root -m 755 "$ROOT"
install -m 644 "$(dirname "$0")/landing/index.html" "$ROOT/index.html"

cat > /etc/nginx/sites-available/001-landing.conf <<VHOST
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    root ${ROOT};
    index index.html;

    access_log /var/log/nginx/landing.access.log;
    error_log  /var/log/nginx/landing.error.log;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Static page, no upstream — but keep the shared fallback so a missing
    # file shows the same "unavailable" page as everything else.
    error_page 502 503 504 /_unavailable.html;
    location = /_unavailable.html {
        root /var/www/errors;
        rewrite ^ /unavailable.html break;
        internal;
    }
}
VHOST
ln -sf /etc/nginx/sites-available/001-landing.conf /etc/nginx/sites-enabled/

nginx -t && systemctl reload nginx
echo "==> ${DOMAIN} and www.${DOMAIN} now serve ${ROOT}/index.html"
