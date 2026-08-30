# Deployment

The platform runs on a single DigitalOcean droplet (Frankfurt, 4 GB / 2 vCPU),
behind nginx, deployed automatically when `main` goes green.

## How a deploy happens

1. A PR merges to `main`.
2. `CI` runs (ingestion tests, clients-api build, dbt build).
3. On success, `Deploy` SSHes to the droplet as `deploy` and runs
   [`deploy/deploy.sh`](deploy.sh): fetch, hard reset to `origin/main`,
   `docker compose build`, `up -d --wait`, prune.

Deploy never runs on a red build. `workflow_dispatch` triggers a manual redeploy.

## Server layout

```
/var/www/production/                    root:app-admins, 2775 + default ACLs
  self-reliance-analytics-platform/     the deploy checkout (git, tracking main)
    .env                                generated once, never committed
```

| Account    | Groups        | Can |
|------------|---------------|-----|
| `<admin>`   | sudo, app-admins, docker | everything |
| `deploy`   | app-admins, docker | run deploys; no interactive sudo |
| `reviewer` | app-viewers   | read `/var/www/production`, `sudo app-status`, `sudo app-logs <app>` — nothing else |

`app-admins` gets write access to the app root and passwordless sudo limited to
nginx reload/restart/test. `app-viewers` gets read-only ACLs plus two read-only
wrapper commands.

## Ports and TLS

Nothing but 22, 80 and 443 is reachable from the internet. Every container port
is bound to `127.0.0.1` by [`compose.prod.yml`](compose.prod.yml) and reached
only through an nginx vhost. This is deliberate and not merely belt-and-braces:
Docker installs its own iptables rules and **bypasses ufw**, so a `0.0.0.0`
binding would be publicly reachable no matter what the firewall says.

Subdomains, each an nginx vhost with its own Let's Encrypt certificate:

| Host | Proxies to | What |
|------|-----------|------|
| `api.example.com`     | `127.0.0.1:4000` | clients-api (simulated source system) |
| `airflow.example.com` | `127.0.0.1:8080` | Airflow UI |
| `grafana.example.com` | `127.0.0.1:3000` | Grafana dashboards |

Add another with `sudo app-site <subdomain> <port>`, then
`sudo certbot --nginx -d <subdomain>.example.com`.

Prometheus (9090), ClickHouse (8123/9000), Kafka (29092), Kafka Connect (8083)
and both Postgres instances stay loopback-only. Reach them over an SSH tunnel:

```bash
ssh -L 9090:localhost:9090 -L 8123:localhost:8123 <admin>@<droplet-ip>
```

## Memory

The droplet has 3.8 GB usable and the stack wants ~5–6 GB unconstrained, so
[`compose.prod.yml`](compose.prod.yml) caps every service and
[`clickhouse-memory.xml`](clickhouse-memory.xml) holds ClickHouse to 600 MB.
Both JVMs are pinned to a 512 MB heap. A 4 GB swapfile absorbs build spikes.
This is a demo-sized deployment: it is tuned to fit, not to perform.

## First-time setup on a fresh box

```bash
sudo deploy/init-env.sh                      # generates .env + admin passwords
sudo -u deploy deploy/deploy.sh              # first build and start
sudo app-site api 4000                       # vhost per app
sudo certbot --nginx -d api.example.com    # TLS
```

## Security note

Anyone who can merge to `main` can execute code on this droplet as `deploy`,
which is in the `docker` group and therefore effectively root. That is inherent
to push-button deploys, not specific to this setup — protect `main` accordingly.
