#!/usr/bin/env bash
# Give `reviewer` a password so it can log in without exchanging SSH keys.
#
# SECURITY NOTE: sshd is key-only globally and stays that way. Password login
# is enabled for this ONE account via a Match block, so a weak password cannot
# be used against joel, deploy or root. reviewer has no sudo beyond two
# read-only wrappers and no docker access, so the blast radius is bounded —
# but a guessable password on a public SSH port will be found by scanners.
set -euo pipefail

PASSWORD=${1:?usage: 25-reviewer-password.sh <password>}

echo "reviewer:${PASSWORD}" | chpasswd
passwd -u reviewer >/dev/null 2>&1 || true

CONF=/etc/ssh/sshd_config.d/60-reviewer-password.conf
cat > "$CONF" <<'SSHD'
# Password login for the read-only reviewer account only. Every other account,
# root included, remains key-only.
Match User reviewer
    PasswordAuthentication yes
    AuthenticationMethods password
SSHD
chmod 644 "$CONF"

sshd -t
systemctl reload ssh 2>/dev/null || systemctl reload sshd
echo "==> reviewer password set; password auth enabled for reviewer only"
sshd -T -C user=reviewer 2>/dev/null | grep -E '^passwordauthentication'
sshd -T -C user=joel     2>/dev/null | grep -E '^passwordauthentication' | sed 's/^/joel: /'
