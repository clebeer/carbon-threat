# Development Guide

## Local setup

### Prerequisites

- Node.js 20 LTS
- PostgreSQL 15+
- npm 10+

### Install dependencies

```bash
npm install          # root workspace dependencies
```

### Configure environment

```bash
cp .env.example .env
# Edit .env — see docs/install/configuration.md for all variables
```

Minimum required in `.env` for local dev:

```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://carbonthreat:password@localhost:5432/carbonthreat
ENCRYPTION_JWT_SIGNING_KEY=<32+ chars>
ENCRYPTION_JWT_REFRESH_SIGNING_KEY=<32+ chars>
ENCRYPTION_KEY=<64 hex chars>
ENCRYPTION_KEYS=[{"isPrimary":true,"id":0,"value":"<32 chars>"}]
DEFAULT_ADMIN_EMAIL=admin@ct.ai
DEFAULT_ADMIN_PASSWORD=CT_Admin@2026
```

### Run locally (with hot reload)

```bash
# Terminal 1 — backend (Babel-Node, port 3001)
npm run dev:server

# Terminal 2 — frontend (Vite dev server, port 5173)
npm run dev:client
```

Open http://localhost:5173 — the Vite proxy forwards `/api/*` to port 3001.

### Database migrations

Migrations run automatically at startup. To run them manually:

```bash
cd td.server && npm run migrate
```

To rollback the last migration:

```bash
cd td.server && npm run migrate:rollback
```

## Building for production

```bash
npm run build        # builds both client and server
```

Output:
- `dist/` — compiled frontend (served as static files by Express)
- `td.server/dist/` — compiled backend

## Running tests

```bash
npm test                    # all tests
npm run test:server         # backend only
npm run test:client         # frontend only
```

## Docker (production stack)

See [install/quickstart.md](../install/quickstart.md).

## Code conventions

- JavaScript (Babel) on the backend — ES modules syntax
- TypeScript on the frontend
- `snake_case` for database columns, `camelCase` for JS, `PascalCase` for classes
- Controllers → Services → Repositories layering (see [architecture.md](architecture.md))
- All mutating routes go through `auditMiddleware` — check `routes.config.js` for examples
