# Provisioning

Numbered, idempotent scripts that build the droplet from a bare Ubuntu 24.04
image. Run in order as root. Re-running any of them is safe.

| Script | Does |
|--------|------|
| `10-base.sh` | packages, 4 GB swap, ufw (22/80/443), fail2ban, unattended security upgrades |
| `20-users.sh` | `app-admins` / `app-viewers` groups, `<admin>` / `deploy` / `reviewer` accounts, `/var/www/production` ownership and ACLs, sudoers |
| `25-reviewer-password.sh` | password login for `reviewer` only, via an sshd Match block |
| `30-runtime.sh` | docker + compose, node 20, pm2 (systemd unit owned by `deploy`), nginx, certbot |
| `40-nginx.sh` | shared proxy snippet, catch-all default server, `app-site` vhost helper |
| `50-helpers.sh` | `app-status` and `app-logs` — the read-only commands `reviewer` may sudo |
| `60-admin-sudo.sh` | passwordless sudo for `<admin>` (key-only account, no password exists) |
| `70-deploy-keys.sh` | CI→server and server→GitHub keypairs |
| `80-deploy-docker.sh` | puts `deploy` in the docker group (see the note in the file) |
| `85-boot-service.sh` | systemd unit that brings the stack up at boot |
| `90-docker-firewall.sh` | DOCKER-USER rules, because Docker bypasses ufw |

Two steps are deliberately not scripted, because both involve moving a private
key or a credential and should be done by a human:

```bash
# 1. Give GitHub Actions the CI private key (run from your workstation)
ssh root@<droplet> 'cat /home/deploy/.ssh/ci_ed25519' \
  | gh secret set DEPLOY_SSH_KEY --repo <owner>/<repo>
ssh-keyscan -t ed25519 <droplet> \
  | gh secret set DEPLOY_KNOWN_HOSTS --repo <owner>/<repo>

# 2. TLS, once DNS resolves
sudo certbot --nginx -d api.example.com -d airflow.example.com -d grafana.example.com
```

## pm2

pm2 is installed with a systemd unit owned by `deploy`, so plain Node apps
dropped in `/var/www/production` survive reboots. This platform does not use
it — the stack is docker compose end to end, and compose is its own supervisor.
Adding pm2 to the mix would mean running one service outside the topology the
rest of the repo documents, for no gain. It is here and ready for the next app.
