# First-Run Setup Wizard

## Automatic admin bootstrap

When CarbonThreat starts for the first time (no users in the database), it automatically
creates a default admin account using the environment variables:

```
DEFAULT_ADMIN_EMAIL=admin@ct.ai
DEFAULT_ADMIN_PASSWORD=CT_Admin@2026
```

These values are pre-configured in the provided `.env` file.

**Default credentials:**

| Field | Value |
|---|---|
| Email | `admin@ct.ai` |
| Password | `CT_Admin@2026` |

> **Security note:** Change this password immediately after the first login
> through **Admin → Users → Edit**.

## Setup wizard

On first startup, the frontend redirects to the setup wizard (`/setup`) when the
application is not yet configured. The wizard guides you through:

1. **Database connection** — verified automatically from environment variables
2. **Authentication type** — choose Local (username/password), SSO/SAML, or OAuth
3. **Admin account** — confirm or override the default credentials

After the wizard is completed, the `app_config` table is populated and the wizard
is no longer shown.

## Resetting to first-run state

To trigger the wizard again (e.g., after a fresh database):

```bash
# Wipe all data and volumes
docker compose -f docker-compose.prod.yml down -v

# Restart fresh
docker compose -f docker-compose.prod.yml up --build -d
```

Or to only reset configuration without wiping threat models:

```bash
docker compose -f docker-compose.prod.yml exec db \
  psql -U carbonthreat -d carbonthreat \
  -c "TRUNCATE app_config, users CASCADE;"
```

After this, the next startup recreates the default admin and the wizard shows again.

## Manual bootstrap via API

You can also bootstrap the admin account directly without the wizard:

```bash
curl -X POST https://localhost/api/auth/local/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ct.ai","password":"CT_Admin@2026"}'
```

This endpoint returns `403` if any user already exists.
