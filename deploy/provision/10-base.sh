#!/usr/bin/env bash
# Base hardening + swap. Idempotent: safe to re-run.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo "==> apt update / upgrade"
apt-get update -qq
apt-get upgrade -y -qq

echo "==> base packages"
apt-get install -y -qq \
  ca-certificates curl gnupg lsb-release \
  git ufw fail2ban unattended-upgrades acl \
  htop ncdu jq rsync

echo "==> swap (4G) — the box has 2G RAM, builds need the headroom"
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
cat > /etc/sysctl.d/99-swap.conf <<'SYSCTL'
vm.swappiness=10
vm.vfs_cache_pressure=50
SYSCTL
sysctl -q --system

echo "==> firewall"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> fail2ban (sshd)"
cat > /etc/fail2ban/jail.local <<'F2B'
[sshd]
enabled = true
maxretry = 5
bantime = 1h
F2B
systemctl enable --now fail2ban >/dev/null

echo "==> unattended security upgrades"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'AUTO'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
AUTO

echo "==> base done"
free -h
