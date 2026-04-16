# Architecture

CarbonThreat is a monorepo with two packages:

| Package | Stack | Description |
|---|---|---|
| `td.server/` | Node.js, Express, Knex, PostgreSQL | REST API backend |
| `ct.client/` | React, Vite, TypeScript, React Query | Single-page application |

Node.js terminates TLS natively configured by environment variables.

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

See [schema.md](schema.md) for the full schema.

## Vulnerability feeds

The `vulnSync` controller fetches advisories from the [OSV API](https://osv.dev)
across 9 ecosystems (npm, PyPI, Go, Maven, NuGet, RubyGems, Docker, Linux, Kubernetes).

Advisories are stored in `vulnerability_advisories` and mapped to STRIDE categories
using keyword analysis. Sync runs are tracked in `vuln_feed_runs`.

Admin-only routes:
- `GET /api/admin/vuln-feeds/status`
- `POST /api/admin/vuln-feeds/sync`

## OSV Vulnerability Scanner

The integrated OSV scanner (`services/osvScanner.js`) allows on-demand scanning of:

- **Lockfiles** — `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `requirements.txt`, `go.sum`, `Cargo.lock`, etc.
- **SBOMs** — CycloneDX (JSON/XML) and SPDX formats
- **Git repositories** — clones and scans all lockfiles in the repo
- **Container images** — pulls the image and scans its dependency manifest

Each scan creates an `osv_scan_runs` record and stores per-vulnerability findings in `osv_scan_findings`. A singleton `osv_scanner_policy` row controls severity thresholds and ignored CVE IDs.

Routes:
- `GET  /api/scanner/scans` — list scan history
- `POST /api/scanner/scans` — submit a new scan (multipart or JSON body)
- `GET  /api/scanner/scans/:id` — scan status + summary
- `GET  /api/scanner/scans/:id/findings` — paginated vulnerability findings
- `GET  /api/scanner/scans/:id/export` — export findings as JSON/CSV
- `DELETE /api/scanner/scans/:id` — delete scan and findings
- `GET  /api/scanner/policy` — read scanner policy
- `PUT  /api/scanner/policy` — update policy (admin only)

## MITRE ATT&CK Framework

The ATT&CK integration (`services/attackFramework.js`) downloads the MITRE Enterprise ATT&CK STIX 2.1 bundle from GitHub and stores it in the local database for offline use.

Four integrated modules:

| Tab | Description |
|---|---|
| **Analysis** | ATT&CK tactic coverage heatmap for a selected threat model |
| **Techniques** | Searchable/filterable browser of all 1,700+ techniques and sub-techniques |
| **Modeling** | Map STRIDE threats to ATT&CK techniques with confidence levels |
| **Report** | Generate and export ATT&CK coverage reports (JSON or Markdown) |

Data is stored in four tables: `attack_objects`, `attack_relationships`, `attack_threat_mappings`, `attack_sync_log`.

Sync is admin-only and fire-and-forget (responds 202 immediately; runs in background).

Routes:
- `GET  /api/attack/status` — sync status + object counts
- `POST /api/attack/sync` — trigger STIX data sync (admin)
- `GET  /api/attack/tactics` — list all 14 enterprise tactics
- `GET  /api/attack/techniques` — search/filter techniques
- `GET  /api/attack/techniques/:attackId` — technique detail + sub-techniques + mitigations
- `GET  /api/attack/groups` — list/search threat groups
- `GET  /api/attack/mitigations` — list/search mitigations
- `GET  /api/attack/analysis/:modelId` — coverage analysis for a model
- `GET  /api/attack/mappings` — list threat→technique mappings
- `POST /api/attack/mappings` — create a mapping
- `DELETE /api/attack/mappings/:id` — delete a mapping
- `GET  /api/attack/reports/:modelId` — generate report (JSON)
- `GET  /api/attack/reports/:modelId/export` — export report (json / markdown)

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
