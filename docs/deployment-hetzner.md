# Deploying FloraFind to Hetzner (alongside gamgee and iris)

This deploys FloraFind on the **same** Hetzner VPS that already runs gamgee and
iris, using the same pattern (host-level Caddy for TLS, a loopback-only compose
stack), so all three apps coexist without interfering. gamgee and iris stay
completely untouched.

This guide assumes that server already exists and is working (Docker and Caddy
are installed from the earlier deploys).

---

## How the apps share one server

```
                          Browser
                             |  HTTPS (443)
                             v
                          Caddy (on the host, one instance)
             /                     |                      \
 gamgee.com          iris-application.com          flora-find.com
     |                       |                            |
 localhost:3000         localhost:3001              localhost:3002
     |                       |                            |
 gamgee stack           iris stack                  flora stack
 /opt/gamgee            /opt/iris                    /opt/flora-find
```

One Caddy instance on the host serves every domain. Each app is a separate
Docker Compose project in its own directory, publishing to a different loopback
port. Nothing about the existing apps changes: you only **add** a FloraFind
block to Caddy and start a third stack.

**The three things that keep them isolated:**

| Concern | gamgee | iris | FloraFind | Result |
| --- | --- | --- | --- | --- |
| Loopback port | `127.0.0.1:3000` | `127.0.0.1:3001` | `127.0.0.1:3002` | no port clash |
| Deploy dir / compose project | `/opt/gamgee` | `/opt/iris` | `/opt/flora-find` | separate containers + volumes |
| Caddy block | `gamgee.com { ... }` | `iris-application.com { ... }` | `flora-find.com { ... }` | one appended block, others left as-is |

FloraFind containers are named `flora-find-app-1` and `flora-find-db-1`; its
volumes are `flora-find_flora_pgdata` and `flora-find_flora_uploads`. None of
these collide with gamgee's or iris's.

**How FloraFind is shaped internally:** it is a single application container,
the FastAPI backend, which serves the API, the uploaded photos under
`/uploads`, and the built React frontend all from one origin on port 8000 (see
the repo `Dockerfile`). Alongside it runs a Postgres `db` container. So the
stack is two services, and the browser only ever talks to the one app port
through Caddy.

---

## 1. Point DNS at the server

You already have the Hetzner server, so you only need a DNS record for the new
domain pointing at the **same** server IP (the one gamgee and iris use).

In your registrar's DNS dashboard, create A records:

| Name | Type | Value |
| --- | --- | --- |
| `@` | A | `YOUR_SERVER_IP` |
| `www` | A | `YOUR_SERVER_IP` |

Wait for DNS to propagate before step 4, since Caddy needs the domain to
resolve to the server to obtain a certificate.

> No new firewall rules are needed: ports 80 and 443 are already open, and
> FloraFind does not publish anything else to the host.

---

## 2. Clone FloraFind into its own directory

SSH into the same server:

```bash
ssh root@YOUR_SERVER_IP
```

Clone FloraFind next to the others, into `/opt/flora-find`:

```bash
git clone https://github.com/LosBobes/flora-find.git /opt/flora-find
cd /opt/flora-find
```

Docker and Caddy are already installed from the earlier deploys, so there is
nothing else to install.

---

## 3. Configure secrets

```bash
cd /opt/flora-find
cp .env.prod.example .env
nano .env
```

Set a strong Postgres password and JWT secret (the app refuses to start without
`FLORA_JWT_SECRET`):

```bash
openssl rand -hex 32   # paste as POSTGRES_PASSWORD
openssl rand -hex 32   # paste as FLORA_JWT_SECRET
```

Minimal `.env`:

```env
POSTGRES_USER=flora
POSTGRES_PASSWORD=<openssl output>
POSTGRES_DB=flora
FLORA_JWT_SECRET=<openssl output>
FLORA_CORS_ORIGINS=https://flora-find.com
```

The `.env` file is gitignored and stays only on the server.

---

## 4. Add the FloraFind block to Caddy (do not overwrite the others)

The server has a single `/etc/caddy/Caddyfile` that already contains gamgee's
and iris's blocks. **Append** FloraFind's block to it; do not replace the file.

```bash
cat /opt/flora-find/Caddyfile >> /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile   # confirm the domain if you ever change it
```

After editing, `/etc/caddy/Caddyfile` should contain all three blocks, for
example:

```
gamgee.com {
    reverse_proxy localhost:3000
}

iris-application.com {
    reverse_proxy localhost:3001
}

flora-find.com {
    reverse_proxy localhost:3002
}
```

Validate and reload Caddy without downtime (this does not affect the other
apps):

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

---

## 5. Build and start the FloraFind stack

```bash
cd /opt/flora-find
docker compose -f docker-compose.prod.yml up --build -d
```

- `--build` builds the app image (frontend + backend) from source, needed on
  first deploy and after code changes.
- `-d` runs detached.
- Only `127.0.0.1:3002` is published, so the stack is reachable only through
  Caddy, never directly from the internet.

FloraFind is now live at `https://flora-find.com`. Caddy provisions the TLS
certificate on the first request (within a few seconds).

Verify the stack is healthy:

```bash
docker compose -f docker-compose.prod.yml ps       # app "Up", db "Up (healthy)"
curl -sS https://flora-find.com/                    # frontend reachable through Caddy
curl -sS https://flora-find.com/api/trees           # API reachable through Caddy
```

Optionally seed the sample data (Belgrade/Serbia plus admin/seed accounts):

```bash
docker compose -f docker-compose.prod.yml exec app python seed.py
```

---

## 6. (Optional) Automatic deploys via GitHub Actions

`.github/workflows/deploy.yml` redeploys FloraFind on every push to `main` by
SSHing in, pulling, and rebuilding, exactly like gamgee and iris. Set these
repository secrets under **GitHub -> repo -> Settings -> Secrets and variables
-> Actions**:

| Secret | Value |
| --- | --- |
| `HETZNER_HOST` | Server IP or hostname (same server as gamgee/iris) |
| `HETZNER_USER` | SSH user (usually `root`) |
| `HETZNER_SSH_KEY` | Private key whose public half is on the server |
| `HETZNER_PORT` | SSH port (optional, defaults to 22) |
| `DEPLOY_PATH` | `/opt/flora-find` |

App runtime secrets (JWT, Postgres password) are NOT set here: they live in the
server's `.env`. If you prefer manual deploys, skip this and use `make deploy`.

---

## Updating after code changes

Manually on the server:

```bash
cd /opt/flora-find
git pull
docker compose -f docker-compose.prod.yml up --build -d
```

Or from your laptop, using the `Makefile` (set `HETZNER_HOST` / `HETZNER_USER`
in your shell profile first):

```bash
make deploy     # git pull + rebuild on the server
make logs       # tail container logs
make ssh        # shell into the server
```

Database and uploaded photos are untouched by rebuilds: they live in the
`flora-find_flora_pgdata` and `flora-find_flora_uploads` named volumes, which
persist across every recreate. Only
`docker compose -f docker-compose.prod.yml down -v` would delete them.
Startup migrations (`backend/app/migrations.py`) run automatically on every
boot against whatever the database contains.

---

## Database access and backups

Postgres is bound to `127.0.0.1:5434` on the server (loopback only, never the
internet). To reach it from your laptop, open a tunnel:

```bash
make db-tunnel   # forwards to localhost:5434
psql postgresql://flora:PASSWORD@localhost:5434/flora
```

To dump the live database:

```bash
ssh root@YOUR_SERVER_IP \
  "docker compose -f /opt/flora-find/docker-compose.prod.yml exec -T db \
   pg_dump -U flora flora" > flora-backup-$(date +%Y%m%d).sql
```

---

## Logs and debugging

```bash
# All FloraFind container logs
docker compose -f docker-compose.prod.yml logs -f

# One service
docker compose -f docker-compose.prod.yml logs -f app

# Caddy (shared with gamgee and iris)
journalctl -u caddy -f
```

---

## Rollback

FloraFind builds from source on the server, so to roll back, check out a
known-good commit and rebuild:

```bash
cd /opt/flora-find
git checkout <known-good-sha>
docker compose -f docker-compose.prod.yml up --build -d
```

Return to automatic updates by checking out `main` again and pushing (or
`make deploy`).

---

## Rollback safety note on Caddy

If you ever need to remove FloraFind, delete only its block from
`/etc/caddy/Caddyfile`, then `systemctl reload caddy` and
`docker compose -f docker-compose.prod.yml down` in `/opt/flora-find`. gamgee's
and iris's blocks and stacks are independent and stay running throughout.
