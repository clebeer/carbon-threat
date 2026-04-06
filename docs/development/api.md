# API Reference

The full interactive API is available at `/api-docs` (Swagger UI) when the server is running.

## Authentication

### Unauthenticated

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/healthz` | Health check |
| `GET` | `/api/config` | App configuration for the frontend |
| `GET` | `/api/config/setup-status` | Returns `{status: "configured"}` or `{status: "unconfigured"}` |
| `POST` | `/api/auth/local/login` | Email + password login — returns `{accessToken, refreshToken, user}` |
| `POST` | `/api/auth/local/bootstrap` | Create first admin (only when no users exist) |
| `POST` | `/api/token/refresh` | Exchange refresh token for a new access token |
| `GET` | `/api/login/:provider` | OAuth login redirect |
| `GET` | `/api/oauth/return` | OAuth callback |
| `GET` | `/api/auth/sso/saml` | SAML login redirect |
| `POST` | `/api/auth/sso/saml/callback` | SAML assertion callback |
| `POST` | `/api/logout` | Logout (invalidates refresh token) |

### Users (admin only unless noted)

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/api/users` | admin | List all users |
| `GET` | `/api/users/:id` | admin, analyst, viewer | Get user by ID |
| `POST` | `/api/users` | admin | Create user |
| `PUT` | `/api/users/:id` | admin, analyst, viewer | Update user |
| `DELETE` | `/api/users/:id` | admin | Deactivate user |

### Threat Models (PostgreSQL-backed)

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/api/threatmodels` | any | List active threat models (`?archived=true` for archived) |
| `POST` | `/api/threatmodels` | admin, analyst | Create threat model |
| `POST` | `/api/threatmodels/import` | admin, analyst | Import threat model from JSON |
| `GET` | `/api/threatmodels/:id` | any | Get threat model by ID |
| `PUT` | `/api/threatmodels/:id` | admin, analyst | Update threat model |
| `PUT` | `/api/threatmodels/:id/restore` | admin, analyst | Restore archived threat model |
| `DELETE` | `/api/threatmodels/:id` | admin, analyst | Archive threat model (soft delete) |
| `POST` | `/api/threatmodels/:id/analyze` | admin, analyst | Run STRIDE rule engine analysis |
| `GET` | `/api/threatmodels/:id/sarif` | any | Export threats as SARIF |

### Threats

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/api/threats` | any | List threats (filterable) |
| `POST` | `/api/threats` | admin, analyst | Create threat |
| `PUT` | `/api/threats/:id` | admin, analyst | Update threat |
| `DELETE` | `/api/threats/:id` | admin, analyst | Delete threat |

### Assets

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/assets` | List assets derived from threat model nodes |

### Templates

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/api/templates/` | any | List templates |
| `POST` | `/api/templates/bootstrap` | admin | Bootstrap template repository |
| `POST` | `/api/templates/import` | admin, analyst | Import template |
| `PUT` | `/api/templates/:id` | admin, analyst | Update template |
| `DELETE` | `/api/templates/:id` | admin | Delete template |
| `GET` | `/api/templates/:id/content` | any | Get template content |

### Domain Packs

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/domain-packs` | List all domain packs |
| `GET` | `/api/domain-packs/:slug` | Get pack details |
| `GET` | `/api/domain-packs/:slug/templates` | List pack templates |
| `POST` | `/api/domain-packs/:slug/templates/:templateId/apply` | Apply template to model |

### Vulnerability Feeds (admin only)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/vuln-feeds/status` | Last sync run + advisory counts by severity |
| `POST` | `/api/admin/vuln-feeds/sync` | Trigger OSV sync (responds immediately, runs async) |

### Configuration (admin only)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/config/smtp` | Get SMTP settings |
| `PUT` | `/api/config/smtp` | Save SMTP settings |
| `POST` | `/api/config/smtp/test` | Test SMTP connection |
| `GET` | `/api/audit` | List audit log entries |

### Integrations (admin manages; analyst/viewer read-only)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/integrations` | List integration configs |
| `GET` | `/api/integrations/:platform` | Get integration config |
| `PUT` | `/api/integrations/:platform` | Upsert integration config (admin) |
| `DELETE` | `/api/integrations/:platform` | Delete integration (admin) |
| `POST` | `/api/integrations/:platform/export` | Export issue to platform |

### AI

| Method | Path | Roles | Description |
|---|---|---|---|
| `POST` | `/api/ai/suggest` | admin, analyst | AI threat suggestions for a diagram |

### Cloud Storage

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/cloud-storage/:provider/status` | OAuth connection status |
| `GET` | `/api/cloud-storage/:provider/auth` | Get OAuth authorization URL |
| `GET` | `/api/cloud-storage/:provider/files` | List files |
| `POST` | `/api/cloud-storage/:provider/import` | Import file from cloud storage |
| `POST` | `/api/cloud-storage/:provider/export` | Export model to cloud storage |
| `DELETE` | `/api/cloud-storage/:provider/disconnect` | Disconnect OAuth |
