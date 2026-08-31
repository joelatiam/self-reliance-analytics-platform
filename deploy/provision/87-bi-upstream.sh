#!/usr/bin/env bash
# Switch the bi vhost from placeholder to a Metabase proxy, in place.
# app-site deliberately refuses to rewrite a certbot-managed vhost (that would
# drop the TLS directives), so the placeholder block is swapped for a proxy
# block and everything certbot added is left untouched.
set -euo pipefail
FILE=/etc/nginx/sites-available/bi.conf
PORT=${1:-3001}

python3 - "$FILE" "$PORT" <<'PY'
import sys
path, port = sys.argv[1], sys.argv[2]
s = open(path).read()
old = """    # No application deployed here yet.
    root /var/www/errors;
    location = /unavailable.html { internal; }
    location / { return 503; }
    error_page 503 /unavailable.html;
"""
new = """    location / {
        proxy_pass http://127.0.0.1:%s;
        include snippets/app-proxy.conf;
    }

    include snippets/app-errors.conf;
""" % port
if old not in s:
    if "proxy_pass" in s:
        print("already proxying; nothing to do"); sys.exit(0)
    print("placeholder block not found", file=sys.stderr); sys.exit(1)
open(path, "w").write(s.replace(old, new))
print("bi.conf now proxies to 127.0.0.1:%s" % port)
PY

nginx -t && systemctl reload nginx
