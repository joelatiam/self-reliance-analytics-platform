#!/usr/bin/env bash
# Two separate keypairs, each with the narrowest job:
#   ci_ed25519     GitHub Actions -> this server, as the `deploy` user
#   github_ed25519 this server -> GitHub, read-only repo deploy key
set -euo pipefail

D=/home/deploy/.ssh
install -d -m 700 -o deploy -g deploy "$D"

[ -f "$D/ci_ed25519" ] || \
  runuser -u deploy -- ssh-keygen -t ed25519 -N '' -C 'github-actions@example.com' -f "$D/ci_ed25519"
[ -f "$D/github_ed25519" ] || \
  runuser -u deploy -- ssh-keygen -t ed25519 -N '' -C 'droplet-deploy-key@example.com' -f "$D/github_ed25519"

# Actions authenticates as deploy with ci_ed25519.
touch "$D/authorized_keys"
grep -qxF "$(cat "$D/ci_ed25519.pub")" "$D/authorized_keys" || cat "$D/ci_ed25519.pub" >> "$D/authorized_keys"

# Outbound git uses the read-only deploy key.
cat > "$D/config" <<'CFG'
Host github.com
  User git
  IdentityFile ~/.ssh/github_ed25519
  IdentitiesOnly yes
CFG
ssh-keyscan -t ed25519 github.com > "$D/known_hosts" 2>/dev/null

chown -R deploy:deploy "$D"
chmod 600 "$D/authorized_keys" "$D/config" "$D/ci_ed25519" "$D/github_ed25519"
chmod 644 "$D/known_hosts" "$D"/*.pub

echo "REPO_DEPLOY_KEY_PUB<<"
cat "$D/github_ed25519.pub"
