#!/usr/bin/env bash
# Docker inserts its own iptables rules ahead of ufw, so a container port
# published on 0.0.0.0 is reachable from the internet even though `ufw status`
# says otherwise. compose.prod.yml binds everything to 127.0.0.1, but that is a
# per-service opt-in — one service added without an override would be exposed.
# DOCKER-USER is evaluated before Docker's own accepts, so this closes the hole
# for every container, present and future.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

WAN=$(ip route get 1.1.1.1 | grep -oP 'dev \K\S+')
echo "==> WAN interface: $WAN"

# Flush only our own additions; Docker recreates the chain with a bare RETURN.
iptables -F DOCKER-USER
# Replies to connections containers opened themselves (World Bank / UNHCR API
# calls) arrive on the WAN interface too — let them back in first.
iptables -A DOCKER-USER -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
# Anything else arriving from the internet toward a container: drop.
iptables -A DOCKER-USER -i "$WAN" -j DROP
iptables -A DOCKER-USER -j RETURN

echo "==> persisting"
echo "iptables-persistent iptables-persistent/autosave_v4 boolean false" | debconf-set-selections
echo "iptables-persistent iptables-persistent/autosave_v6 boolean false" | debconf-set-selections
apt-get install -y -qq iptables-persistent
netfilter-persistent save >/dev/null

echo "==> DOCKER-USER now:"
iptables -L DOCKER-USER -n --line-numbers
