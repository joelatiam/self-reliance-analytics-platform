#!/usr/bin/env bash
# nginx: shared proxy snippet, catch-all default, per-app vhost helper.
set -euo pipefail

DOMAIN=${DOMAIN:-example.com}

echo "==> nginx can traverse the app root (static sites)"
setfacl -R -m u:www-data:rX -m d:u:www-data:rX /var/www/production

echo "==> shared proxy snippet"
cat > /etc/nginx/snippets/app-proxy.conf <<'SNIP'
proxy_http_version 1.1;
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Upgrade           $http_upgrade;
proxy_set_header Connection        "upgrade";
proxy_read_timeout 300s;
proxy_connect_timeout 15s;
SNIP

echo "==> catch-all default: bare IP and unknown hosts get nothing"
rm -f /etc/nginx/sites-enabled/default
cat > /etc/nginx/sites-available/000-catchall.conf <<'CATCH'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    # Drop the connection: no app should be reachable by IP or wrong hostname.
    return 444;
}
CATCH
ln -sf /etc/nginx/sites-available/000-catchall.conf /etc/nginx/sites-enabled/

echo "==> app-site: scaffold a subdomain vhost -> local port"
cat > /usr/local/bin/app-site <<'SITE'
#!/usr/bin/env bash
# app-site <subdomain> <local-port> — create + enable a vhost, then reload.
set -euo pipefail
DOMAIN=${DOMAIN:-example.com}
name=${1:?usage: app-site <subdomain> <local-port>}
port=${2:?usage: app-site <subdomain> <local-port>}
[[ $name =~ ^[a-z0-9-]+$ ]] || { echo "bad subdomain: $name" >&2; exit 2; }
[[ $port =~ ^[0-9]+$   ]] || { echo "bad port: $port"      >&2; exit 2; }

cat > "/etc/nginx/sites-available/${name}.conf" <<VHOST
server {
    listen 80;
    listen [::]:80;
    server_name ${name}.${DOMAIN};

    access_log /var/log/nginx/${name}.access.log;
    error_log  /var/log/nginx/${name}.error.log;

    location / {
        proxy_pass http://127.0.0.1:${port};
        include snippets/app-proxy.conf;
    }
}
VHOST
ln -sf "/etc/nginx/sites-available/${name}.conf" /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
echo "enabled ${name}.${DOMAIN} -> 127.0.0.1:${port}"
echo "TLS:  certbot --nginx -d ${name}.${DOMAIN}"
SITE
chmod 755 /usr/local/bin/app-site

nginx -t && systemctl reload nginx
echo "==> nginx done (domain: ${DOMAIN})"
