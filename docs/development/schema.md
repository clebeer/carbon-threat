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

## OSV Scanner tables

### `osv_scan_runs`
| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `name` | string | User-provided scan label |
| `scan_type` | string | `lockfile` \| `sbom` \| `git` \| `image` |
| `status` | string | `pending` \| `running` \| `complete` \| `error` |
| `source_filename` | string | Original filename (for display and format detection) |
| `lockfile_type` | string | e.g. `npm-package-lock`, `requirements-txt` |
| `packages_scanned` | integer | |
| `vulns_found` | integer | |
| `error_message` | text | Set on failure |
| `created_by` | UUID FK → users | |
| `started_at` | timestamp | |
| `finished_at` | timestamp | |
| `created_at` | timestamp | |

### `osv_scan_findings`
| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `scan_id` | UUID FK → osv_scan_runs | CASCADE on delete |
| `package_name` | string | |
| `package_version` | string | |
| `ecosystem` | string | e.g. `npm`, `PyPI`, `Go` |
| `vuln_id` | string | OSV / CVE / GHSA identifier |
| `title` | string | |
| `description` | text | |
| `severity` | string | Critical / High / Medium / Low |
| `cvss_score` | decimal(4,1) | |
| `stride_categories` | TEXT[] | Derived STRIDE categories |
| `fixed_version` | string | Earliest fixed version |
| `affected_versions` | JSONB | Raw affected ranges from OSV |
| `references` | JSONB | Advisory reference URLs |
| `is_ignored` | boolean | Matches `osv_scanner_policy.ignored_vuln_ids` |
| `created_at` | timestamp | |

### `osv_scanner_policy`
| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Singleton row |
| `ignored_vuln_ids` | JSONB | Array of OSV/CVE IDs to suppress |
| `severity_threshold` | string | Minimum severity to store — default `Low` |
| `auto_enrich_threats` | boolean | Automatically link findings to STRIDE threats |
| `updated_at` | timestamp | |

## MITRE ATT&CK tables

### `attack_objects`
| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `attack_id` | string UNIQUE | External ATT&CK ID, e.g. `TA0001`, `T1059`, `T1059.003` |
| `type` | string | `tactic` \| `technique` \| `sub-technique` \| `group` \| `mitigation` \| `software` |
| `name` | string | |
| `description` | text | |
| `platforms` | TEXT[] | Operating systems / environments (techniques only) |
| `kill_chain_phases` | JSONB | `[{ kill_chain_name, phase_name }]` |
| `parent_id` | UUID FK → attack_objects | Sub-technique parent |
| `aliases` | TEXT[] | Alternative names (groups / software) |
| `url` | text | Canonical ATT&CK URL |
| `stix_id` | string UNIQUE | Original STIX 2.1 identifier |
| `is_deprecated` | boolean | |
| `is_revoked` | boolean | |
| `extra` | JSONB | Additional STIX metadata (detection, data sources, etc.) |
| `created_at` / `updated_at` | timestamp | |

### `attack_relationships`
| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `source_id` | UUID FK → attack_objects | |
| `target_id` | UUID FK → attack_objects | |
| `relationship_type` | string | `mitigates` \| `subtechnique-of` \| `uses` \| `attributed-to` |
| `stix_id` | string UNIQUE | |

### `attack_threat_mappings`
| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `threat_id` | UUID FK → threats | Optional — link to a specific STRIDE threat |
| `technique_id` | UUID FK → attack_objects | Required |
| `model_id` | UUID FK → threat_models | Optional — scope to a threat model |
| `created_by` | UUID FK → users | |
| `confidence` | string | `high` \| `medium` \| `low` |
| `notes` | text | |
| `created_at` | timestamp | |

### `attack_sync_log`
| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `domain` | string | `enterprise-attack` \| `mobile-attack` \| `ics-attack` |
| `attack_version` | string | ATT&CK version from the STIX bundle, e.g. `18.1` |
| `objects_synced` | integer | |
| `relationships_synced` | integer | |
| `status` | string | `pending` \| `running` \| `complete` \| `error` |
| `error_message` | text | |
| `triggered_by` | UUID FK → users | |
| `started_at` | timestamp | |
| `finished_at` | timestamp | |

## Other tables

- `templates` — threat model templates (title, content JSONB, tags)
- `domain_packs` — domain-specific threat packs (slug, name, rules JSONB)
- `integrations` — external platform configs (Jira, GitHub Issues, etc.)
- `assets` — derived from threat model nodes (type, name, threat_model_id)
- `tokens` — refresh token registry for revocation
