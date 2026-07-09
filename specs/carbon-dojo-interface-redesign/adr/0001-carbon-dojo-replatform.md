# ADR 0001 — Carbon Dojo re-platform: backend foundation

- **Status:** Accepted
- **Date:** 2026-07-09
- **Context:** SDD `specs/carbon-dojo-interface-redesign/SDD-carbon-dojo-v2.md`, Phase 1.

## Decision 1 — Reuse `td.server` (Node/Express/Knex/PostgreSQL)

We build the new vulnerability-management domain **inside the existing `td.server`**
rather than starting a new service. Rationale: the existing stack already provides
auth (JWT/SAML/OIDC), RBAC (roles + `role_permissions` + permission catalog), audit,
encryption (AES-256-GCM), migrations, and issue-tracker integrations — all reused by
Carbon Dojo. A separate service would duplicate these with no offsetting benefit.

New domain code follows the existing layout: `db/migrations/`, `controllers/`,
`services/`, `repositories/`, `auth/`.

## Decision 2 — Full removal of the threat-modeling IA

Per the user decision (2026-07-09) the threat-modeling IA is **removed**, not kept
behind a flag. Frontend removal already landed (commit 99d224f6). Backend removal is
staged and happens per-vertical during Phase 2, **after** salvaging reusable pieces:

- **Salvage:** OSV scanner (→ import source), report exporters (PDF/SARIF), issue
  integrations (Jira/GitHub/GitLab), auth/SSO/RBAC, audit, backup, SMTP/Teams.
- **Remove (Phase 2, per vertical):** `threatmodelcontroller`, `threats.pg`,
  `strideController`/`strideEngineService`, `attackController`/`attackFramework`,
  `assetLibraryController`, `domainPacksController`, `templateController`, and the
  `stride-engine` Python service. Old permission keys (`threatmodel:*`, `threats:*`,
  `attack:*`, `scanner:*` as-is) are deprecated but left in place until their
  controllers are deleted, to avoid orphaning seeded grants mid-migration.

Data migration: none required for the new domain (greenfield tables); any historical
threat-model data export is out of scope (product pivot, not a data migration).

## Decision 3 — Multi-tenancy: `org_id` column + row-level scoping, deny-Global-by-default

Every tenant-scoped table carries a non-null `org_id` (denormalized down the
hierarchy so `products`/`engagements`/`findings` can be scoped with a single
predicate — no joins up to `organizations`). Authorization resolves the principal's
`org_id` and:

- **Denies when the principal has no tenant scope** (`org_id` null / "Global") — this
  is the root cause of the pentest findings CD-02/CD-04/BOLA (`f15`, `f17`, `f18`):
  the old code fell back to Global. We invert that: no scope ⇒ 403.
- **Denies cross-tenant** access (resource `org_id` ≠ principal `org_id`) ⇒ 403,
  closing IDOR/BOLA (`f13`, `f17`, `f20`).
- **Service accounts are never global by default** — they carry an `org_id` and an
  explicit scope list; scope is evaluated *before* any privilege check (closes `f18`).

Implemented as `src/auth/tenantScope.js` (`assertTenantAccess`, `scopeQuery`,
`requireTenantScope` middleware) with unit tests. Endpoint-level BOLA/IDOR tests land
per-vertical in Phase 2 (they need live routes).

## Decision 4 — Roles & permissions

Add Carbon Dojo roles alongside `admin`: **Red Team Manager** (`rt_manager`),
**Red Team Analyst** (`rt_analyst`), **Dev Owner** (`dev_owner`), **Reader**
(`reader`). New permission keys are added to `permissions.catalog.js` and granted per
role in migration `021`. `admin` keeps full access. The legacy `analyst`/`viewer`/
`api_key` roles remain until their surfaces are removed.

## Decision 5 — Secrets: distinct KEKs, write-only storage

Connector tokens and IdP secrets are stored **encrypted** (existing AES-256-GCM) in
`*_ciphertext` columns and are **never** returned by the API (write-only; the API
exposes only a `secret_set` boolean). A **connector master key distinct from the app
encryption key** is required (closes KEK-reuse `f7`); deploy-time validation rejects
equal keys. Retention/purge jobs for `audit`/`sessions` (LGPD, `f8`) are scheduled in
Phase 5.

## Consequences

- Greenfield tables (migrations 018–021) coexist with legacy tables until Phase 2
  deletes the legacy surfaces.
- The frontend's mock data layer (`ct.client/src/api/carbon.ts`) is swapped for these
  endpoints as each Phase 2 vertical lands.
