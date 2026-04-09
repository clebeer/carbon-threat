# Quick Start — Docker (Production)

CarbonThreat ships with a production-ready Docker Compose stack (Node app + PostgreSQL + Nginx with TLS).

## Prerequisites

- Docker Desktop or Docker Engine with Compose v2
- `openssl` (for generating TLS certificates)

## 1. Clone and configure

```bash
git clone <repo-url> carbon-threat
cd carbon-threat
cp minimal.env .env   # then edit secrets — see install/configuration.md
```

## 2. Generate local TLS certificates (first run only)

```bash
bash scripts/gen-local-certs.sh
```

This creates `nginx/certs/` with a self-signed certificate for `localhost`.

## 3. Start the stack

```bash
docker compose up --build -d
```

Services started:

| Service | Container | Port |
|---|---|---|
| PostgreSQL | `carbonthreat-db` | 5432 (internal) |
| Node app | `carbonthreat-app` | 3001 (App Native) |

## 4. First-run wizard

Open **https://localhost:3001** in your browser.

If no users exist, the setup wizard runs automatically. After completing the wizard,
the default admin account is available immediately — see [wizard.md](wizard.md).

> On first startup the database migrations run automatically and the default admin
> is created if `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` are set in `.env`.

## 5. Verify the stack is healthy

```bash
docker compose ps
docker compose logs carbonthreat --tail=30
```

All containers should show `healthy` or `running`.

## Stopping the stack

```bash
docker compose --profile tls down
```

To also wipe the database volume:

```bash
docker compose --profile tls down -v
```

## Development mode

To run frontend and backend separately with hot reload:

```bash
# Terminal 1 — backend
npm run dev:server

# Terminal 2 — frontend (Vite dev server on :5173)
npm run dev:client
```

Requires a local PostgreSQL instance and a valid `.env` file.
