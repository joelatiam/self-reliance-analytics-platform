#!/usr/bin/env bash
# Users, groups and /var/www/production ownership. Idempotent.
set -euo pipefail

ADMIN_USER=${ADMIN_USER:?set ADMIN_USER to the interactive admin account}
APP_ROOT=/var/www/production
ROOT_KEY=$(head -1 /root/.ssh/authorized_keys)

add_group() { getent group "$1" >/dev/null || groupadd "$1"; }
add_user()  { id "$1" >/dev/null 2>&1 || useradd -m -s /bin/bash "$1"; }

install_key() { # install_key <user> <key>
  local u=$1 k=$2 h; h=$(getent passwd "$u" | cut -d: -f6)
  install -d -m 700 -o "$u" -g "$u" "$h/.ssh"
  touch "$h/.ssh/authorized_keys"
  grep -qxF "$k" "$h/.ssh/authorized_keys" || echo "$k" >> "$h/.ssh/authorized_keys"
  chmod 600 "$h/.ssh/authorized_keys"; chown "$u:$u" "$h/.ssh/authorized_keys"
}

echo "==> groups"
add_group app-admins   # write + manage apps
add_group app-viewers  # read-only

echo "==> $ADMIN_USER (admin)"
add_user "$ADMIN_USER"
usermod -aG sudo,app-admins "$ADMIN_USER"
install_key "$ADMIN_USER" "$ROOT_KEY"

echo "==> deploy (CI account, no interactive sudo)"
add_user deploy
usermod -aG app-admins deploy

echo "==> reviewer (read-only)"
add_user reviewer
usermod -aG app-viewers reviewer
# NOTE: seeded with the provisioning key so the account is usable immediately.
# Replace with the reviewer's own key and remove this one.
install_key reviewer "$ROOT_KEY"

echo "==> $APP_ROOT"
install -d -o root -g app-admins -m 2775 "$APP_ROOT"
# `other` keeps read+traverse on purpose. Containers bind-mount config out of
# the checkout and run as their own unprivileged UIDs (postgres 999,
# prometheus 65534, airflow 50000) which are in none of these groups — locking
# `other` out stops those services booting at all. Write access is what the
# group gates; secrets live in .env at 0640, not in directory permissions.
setfacl -R  -m g:app-admins:rwX -m g:app-viewers:rX -m u:www-data:rX -m o::r-X "$APP_ROOT"
setfacl -Rd -m g:app-admins:rwX -m g:app-viewers:rX -m u:www-data:rX -m o::r-X "$APP_ROOT"

echo "==> sudoers"
cat > /etc/sudoers.d/app-admins <<'SUDO'
# App admins: manage web server + app lifecycle without full root.
%app-admins ALL=(root) NOPASSWD: /usr/bin/systemctl reload nginx, \
    /usr/bin/systemctl restart nginx, /usr/bin/systemctl status nginx, \
    /usr/sbin/nginx -t, /usr/local/bin/app-status, /usr/local/bin/app-logs
SUDO

cat > /etc/sudoers.d/app-viewers <<'SUDO'
# Reviewers: look, don't touch. Read-only wrappers only.
%app-viewers ALL=(root) NOPASSWD: /usr/local/bin/app-status, /usr/local/bin/app-logs
SUDO

chmod 440 /etc/sudoers.d/app-admins /etc/sudoers.d/app-viewers
visudo -cf /etc/sudoers.d/app-admins
visudo -cf /etc/sudoers.d/app-viewers

echo "==> users done"
for u in "$ADMIN_USER" deploy reviewer; do id "$u"; done
ls -ld "$APP_ROOT"; getfacl -p "$APP_ROOT" 2>/dev/null | sed 's/^/    /'
