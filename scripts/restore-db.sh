#!/usr/bin/env bash
# =============================================================================
# CarbonThreat — PostgreSQL restore script
#
# Usage:
#   ./scripts/restore-db.sh <backup_file.sql.gz>
#
# Environment variables: same as backup-db.sh
#
# WARNING: This will DROP and recreate the target database!
#          Always confirm before running in production.
# =============================================================================
set -euo pipefail

BACKUP_FILE="${1:-}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <backup_file.sql.gz>" >&2
  echo ""
  echo "Available backups:"
  ls -lth "$(dirname "$0")/../backups/"carbonthreat-*.sql.gz 2>/dev/null || echo "  (none found)"
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "[restore-db] ERROR: File not found: $BACKUP_FILE" >&2
  exit 1
fi

DB_USER="${DB_USER:-carbonthreat}"
DB_NAME="${DB_NAME:-carbonthreat}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  WARNING: This will DESTROY the current database!        ║"
echo "║  Target: ${DB_NAME}@${DB_HOST}:${DB_PORT}               "
echo "║  Source: $(basename "$BACKUP_FILE")                      "
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
read -r -p "Type 'yes' to confirm: " CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
  echo "[restore-db] Aborted." >&2
  exit 1
fi

echo "[restore-db] Dropping and recreating database ${DB_NAME}..."
PGPASSWORD="${DB_PASSWORD:-}" psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname=postgres \
  -c "DROP DATABASE IF EXISTS ${DB_NAME};" \
  -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

echo "[restore-db] Restoring from ${BACKUP_FILE}..."
gunzip -c "$BACKUP_FILE" | PGPASSWORD="${DB_PASSWORD:-}" psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME"

echo "[restore-db] Restore complete."
