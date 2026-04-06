# Architecture

CarbonThreat is a monorepo with two packages:

| Package | Stack | Description |
|---|---|---|
| `td.server/` | Node.js, Express, Knex, PostgreSQL | REST API backend |
| `ct.client/` | React, Vite, TypeScript, React Query | Single-page application |

Nginx terminates TLS and reverse-proxies to the Node server in production.

## Backend layers

```
HTTP Request
    ↓
Router (routes.config.js)        — URL → controller mapping, RBAC middleware
    ↓
Controller (controllers/*.js)    — HTTP only: parse input, call service, respond
    ↓
Service (services/*.js)          — Business logic, no request/response objects
    ↓
Repository (repositories/*.js)   — Data access via Knex query builder
    ↓
PostgreSQL
```

### Conventions

- Controllers handle HTTP and nothing else.
- Business rules live in services.
- Knex queries stay in repositories.
- Column names: `snake_case`. JS variables: `camelCase`. Constants: `SCREAMING_SNAKE_CASE`.

## Authentication

- **Local auth**: email + bcrypt password, returns JWT access + refresh tokens.
- **OAuth**: GitHub, GitLab, Bitbucket, Google via Passport.js.
- **SAML/SSO**: enterprise IdP via `passport-saml`.
- All protected routes require `Authorization: Bearer <accessToken>`.
- Token refresh: `POST /api/token/refresh` — works with expired access tokens.

## RBAC

Three roles: `admin`, `analyst`, `viewer`.

Middleware: `requireRole('admin', 'analyst')` — enforced per-route in `routes.config.js`.

## Security middleware

- `helmet` — security headers (CSP, HSTS, etc.)
- `express-rate-limit` — global limiter in production; strict limiter on auth endpoints
- `auditMiddleware` — writes append-only audit log entries for mutating operations
- `assertSecretEntropy()` — validates JWT and encryption keys at startup (refuses to start if weak)

## Database

PostgreSQL managed via Knex.js. Migrations run automatically at startup.

See [database.md](database.md) for the full schema.

## Vulnerability feeds

The `vulnSync` controller fetches advisories from the [OSV API](https://osv.dev)
across 9 ecosystems (npm, PyPI, Go, Maven, NuGet, RubyGems, Docker, Linux, Kubernetes).

Advisories are stored in `vulnerability_advisories` and mapped to STRIDE categories
using keyword analysis. Sync runs are tracked in `vuln_feed_runs`.

Admin-only routes:
- `GET /api/admin/vuln-feeds/status`
- `POST /api/admin/vuln-feeds/sync`

## Frontend structure

```
ct.client/src/
  api/          — typed API client functions (axios wrappers)
  views/        — page-level React components
  components/   — reusable UI components
  store/        — Zustand global state
  router/       — React Router configuration
```

React Query handles all server state (caching, background refetch, mutations).

## Monitoring

- Winston structured logging (JSON in production)
- Health endpoints: `GET /api/healthz`
- OpenAPI/Swagger UI: `GET /api-docs`
