#!/usr/bin/env bash
# Runtime: docker, node 20 (matches CI), pm2, nginx, certbot. Idempotent.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
ADMIN_USER=${ADMIN_USER:?set ADMIN_USER to the interactive admin account}

echo "==> docker engine + compose plugin"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker >/dev/null
# Admin account only: docker group membership is root-equivalent, so the CI account
# (deploy) deliberately stays out of it.
usermod -aG docker "$ADMIN_USER"

echo "==> node 20 (CI builds on 20)"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1)" != "v20" ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi

echo "==> pm2 (daemon owned by the deploy user)"
npm install -g pm2@latest >/dev/null 2>&1
pm2 startup systemd -u deploy --hp /home/deploy >/dev/null
systemctl enable pm2-deploy >/dev/null 2>&1 || true
install -d -o deploy -g app-admins -m 2750 /var/log/pm2
setfacl -m g:app-viewers:rX -m d:g:app-viewers:rX /var/log/pm2 || true

echo "==> nginx + certbot"
apt-get install -y -qq nginx python3-certbot-nginx
systemctl enable --now nginx >/dev/null

echo "==> runtime done"
docker --version; docker compose version; node -v; npm -v; pm2 -v; nginx -v
