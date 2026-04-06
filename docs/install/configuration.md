# Environment Configuration

All configuration is done via environment variables in the `.env` file at the project root.
Copy `.env.example` to `.env` and fill in your values before starting.

## Application

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `production` | `production` or `development` |
| `PORT` | `3001` | Port the Node server listens on (internal) |
| `LOG_LEVEL` | `info` | Winston log level: `debug`, `info`, `warn`, `error` |
| `APP_HOSTNAME` | `localhost` | Public hostname of the application |
| `SERVER_API_PROTOCOL` | `http` | Protocol Node uses internally (`http` behind nginx TLS) |

## Database (PostgreSQL)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes (Docker) | Full connection string — set automatically by docker-compose |
| `DB_USER` | Yes | PostgreSQL username |
| `DB_PASSWORD` | Yes | PostgreSQL password |
| `DB_NAME` | Yes | Database name |

## Default Admin

| Variable | Description |
|---|---|
| `DEFAULT_ADMIN_EMAIL` | Email for the auto-created admin (first startup only) |
| `DEFAULT_ADMIN_PASSWORD` | Password for the auto-created admin (first startup only) |

The default admin is created **only when the users table is empty**. Set these in `.env`:

```
DEFAULT_ADMIN_EMAIL=admin@ct.ai
DEFAULT_ADMIN_PASSWORD=CT_Admin@2026
```

## Secrets (required)

Generate strong values before any non-local deployment:

```bash
openssl rand -base64 48   # for JWT keys
openssl rand -hex 32      # for ENCRYPTION_KEY
```

| Variable | Min length | Description |
|---|---|---|
| `ENCRYPTION_JWT_SIGNING_KEY` | 32 chars | JWT access token signing key |
| `ENCRYPTION_JWT_REFRESH_SIGNING_KEY` | 32 chars | JWT refresh token signing key |
| `ENCRYPTION_KEY` | 64 hex chars | AES-256-GCM key for threat model encryption at rest |
| `ENCRYPTION_KEYS` | — | JSON array `[{"isPrimary":true,"id":0,"value":"...32chars..."}]` |

The server **refuses to start** if any secret is missing or has insufficient entropy.

## AI Integration (optional)

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key — leave blank to disable |
| `OLLAMA_URL` | Ollama endpoint URL (local LLM) |
| `OLLAMA_MODEL` | Model name for Ollama (e.g. `llama3`) |

## SSO / SAML (optional)

| Variable | Description |
|---|---|
| `SAML_ENTRY_POINT` | IdP SSO URL |
| `SAML_ISSUER` | SP entity ID |
| `SAML_CERT` | IdP X.509 certificate (PEM, base64) |

## OAuth Providers (optional)

| Variable | Description |
|---|---|
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth app |
| `GITLAB_CLIENT_ID` / `GITLAB_CLIENT_SECRET` | GitLab OAuth app |
| `BITBUCKET_CLIENT_ID` / `BITBUCKET_CLIENT_SECRET` | Bitbucket OAuth app |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth app |
