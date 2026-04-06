# Database Schema

PostgreSQL. Migrations are in `td.server/src/db/migrations/` and run automatically at startup.

## Core tables

### `users`
| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `email` | string UNIQUE | Lowercase |
| `password_hash` | string | bcrypt — null for OAuth-only users |
| `role` | string | `admin` \| `analyst` \| `viewer` |
| `is_active` | boolean | Soft-disable without deletion |
| `last_login_at` | timestamp | |
| `created_at` | timestamp | |

### `app_config`
| Column | Type | Description |
|---|---|---|
| `key` | string PK | Config key (e.g. `auth_type`) |
| `value` | text | Config value |

Populated by the setup wizard. `auth_type` presence determines whether the wizard has been completed.

### `threat_models`
| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `title` | string | |
| `description` | text | |
| `owner_id` | UUID FK → users | |
| `content` | JSONB | Diagram data (encrypted at rest) |
| `is_archived` | boolean | Soft delete / archive |
| `created_at` / `updated_at` | timestamp | |

### `threats`
| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `threat_model_id` | UUID FK → threat_models | |
| `title` | string | |
| `description` | text | |
| `stride_category` | string | Spoofing / Tampering / Repudiation / Information Disclosure / DoS / Elevation of Privilege |
| `severity` | string | Critical / High / Medium / Low |
| `mitigation` | text | |
| `status` | string | `open` \| `mitigated` \| `accepted` |
| `created_at` / `updated_at` | timestamp | |

### `audit_logs`
| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `action` | string | e.g. `MODEL_CREATE`, `USER_UPDATE` |
| `resource` | string | Resource type |
| `resource_id` | string | |
| `metadata` | JSONB | Additional context |
| `created_at` | timestamp | |

Append-only — no UPDATE/DELETE on this table.

## Vulnerability intelligence tables

### `vulnerability_advisories`
| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `source_id` | string | e.g. `CVE-2024-12345`, `GHSA-xxxx` |
| `source` | string | `osv` \| `nvd` \| `cisa_kev` |
| `title` | string | |
| `description` | text | |
| `severity` | string | Critical / High / Medium / Low |
| `stride_categories` | TEXT[] | STRIDE categories derived from advisory content |
| `affected` | JSONB | Affected packages and version ranges |
| `cvss_score` | decimal(4,1) | |
| `references` | JSONB | Array of reference URLs |
| `published_at` | timestamp | |
| `synced_at` | timestamp | Last sync timestamp |

### `vuln_feed_runs`
| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `status` | string | `running` \| `success` \| `partial` \| `error` |
| `fetched` | integer | Total advisories fetched from APIs |
| `inserted` | integer | New advisories added |
| `updated` | integer | Existing advisories updated |
| `error_message` | text | Set on failure |
| `started_at` | timestamp | |
| `finished_at` | timestamp | |

## Other tables

- `templates` — threat model templates (title, content JSONB, tags)
- `domain_packs` — domain-specific threat packs (slug, name, rules JSONB)
- `integrations` — external platform configs (Jira, GitHub Issues, etc.)
- `assets` — derived from threat model nodes (type, name, threat_model_id)
- `tokens` — refresh token registry for revocation
