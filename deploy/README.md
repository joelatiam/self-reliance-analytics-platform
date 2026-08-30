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

> `reviewer` is seeded with the provisioning key so the account works
> immediately. Replace it with the reviewer's own public key
> before handing the address out:
> `sudo -u reviewer nano ~reviewer/.ssh/authorized_keys`.

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
| `bi.example.com`      | — | reserved; no application deployed behind it yet |

When an upstream cannot be reached — service stopped, mid-restart, or never
deployed — the vhost serves a plain "this application isn't available" page
instead of nginx's default error or a browser timeout. The same page answers any
unconfigured subdomain, which matters with a wildcard A record: a typo'd address
gets an explanation rather than a hang.

`proxy_intercept_errors` is deliberately left off, so a 502 the *application*
returns still reaches the client. Only nginx's own "upstream unreachable" errors
are replaced; masking real application errors behind a friendly page would hide
bugs.

Add another app, or reserve an address for one that does not exist yet:

```bash
sudo app-site reports 8090   # proxy to a local port
sudo app-site reports        # placeholder, serves the unavailable page
```

Then issue certificates. This is a human-run step, not automation: it registers
an ACME account against your email and accepts the Let's Encrypt subscriber
agreement. It waits for DNS to propagate before trying, so it can be run
immediately after adding the records.

```bash
sudo app-tls you@example.com                # apex, www and every subdomain
sudo app-tls you@example.com reports        # just one
sudo app-tls you@example.com @              # the apex only
```

`@` means the apex; every other argument is treated as a subdomain label.

Renewal is handled by `certbot.timer`, already enabled.

Prometheus (9090), ClickHouse (8123/9000), Kafka (29092), Kafka Connect (8083)
and both Postgres instances stay loopback-only. Reach them over an SSH tunnel:

```bash
ssh -L 9090:localhost:9090 -L 8123:localhost:8123 <admin>@<droplet-ip>
```

## Memory

The droplet has 3.8 GB usable and the stack wants ~5–6 GB unconstrained, so
[`compose.prod.yml`](compose.prod.yml) caps every service and
[`clickhouse-memory.xml`](clickhouse-memory.xml) holds ClickHouse to 600 MB.
Both JVMs are pinned to a 512 MB heap and a 4 GB swapfile absorbs spikes.

Caps were sized from measured `docker stats`, not guessed, after a first pass
got Airflow wrong in both directions. Two findings worth keeping:

- **dbt runs inside the scheduler**, so the scheduler's cap must cover a dbt
  build, not its idle footprint. Starved, dbt dies before its logger starts and
  exits 2 with no output whatsoever.
- **The webserver is the largest consumer**, mostly gunicorn workers. Airflow
  defaults to 4, which buys nothing on 2 vCPUs; it runs 2 here.

Steady state after a full pipeline run: ~2.8 GB resident, ~350 MB swap. It fits,
but there is little slack — this is tuned to fit, not to perform. On a larger
box the caps stay valid (they are ceilings, not reservations); just raise them.

Check with `sudo app-status`, or per-service ceiling pressure with:

```bash
docker exec wb-airflow-webserver cat /sys/fs/cgroup/memory.events
```

A non-zero and climbing `max` means that service is being throttled at its cap.

## Reboot behaviour

Every long-running service is `restart: unless-stopped`, so the stack returns
by itself after a reboot, a resize, or an unattended kernel upgrade. The one-shot
init containers (`connector-init`, `airflow-init`) are excluded so they do not
loop. The base compose sets no restart policy at all, which is fine for a laptop
and wrong for a server.

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
