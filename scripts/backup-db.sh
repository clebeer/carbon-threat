#!/usr/bin/env bash
# =============================================================================
# CarbonThreat — PostgreSQL backup script
#
# Usage:
#   ./scripts/backup-db.sh [backup_dir]
#
# Environment:
#   DB_USER      — PostgreSQL username (default: carbonthreat)
#   DB_NAME      — Database name (default: carbonthreat)
#   DB_HOST      — Host (default: localhost; use 127.0.0.1 in containers)
#   DB_PORT      — Port (default: 5432)
#   DB_PASSWORD  — Password (optional; use .pgpass for production)
#   BACKUP_KEEP  — Number of daily backups to retain (default: 14)
#
# Docker Compose usage:
#   docker compose exec db sh -c "PGPASSWORD=\$POSTGRES_PASSWORD pg_dump -U \$POSTGRES_USER \$POSTGRES_DB" \
#     | gzip > backups/carbonthreat-$(date +%Y%m%d-%H%M%S).sql.gz
#
# Scheduled (cron example — run daily at 02:00):
#   0 2 * * * /path/to/scripts/backup-db.sh /var/backups/carbonthreat >> /var/log/ct-backup.log 2>&1
# =============================================================================
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
DB_USER="${DB_USER:-carbonthreat}"
DB_NAME="${DB_NAME:-carbonthreat}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
BACKUP_DIR="${1:-$(dirname "$0")/../backups}"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/carbonthreat-${TIMESTAMP}.sql.gz"

# ── Pre-flight ────────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

if ! command -v pg_dump &>/dev/null; then
  echo "[backup-db] ERROR: pg_dump not found. Install postgresql-client." >&2
  exit 1
fi

# ── Dump ──────────────────────────────────────────────────────────────────────
echo "[backup-db] Starting backup of ${DB_NAME}@${DB_HOST}:${DB_PORT} → ${BACKUP_FILE}"

PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --format=plain \
  --no-owner \
  --no-privileges \
  | gzip -9 > "$BACKUP_FILE"

SIZE="$(du -sh "$BACKUP_FILE" | cut -f1)"
echo "[backup-db] Backup complete: ${BACKUP_FILE} (${SIZE})"

# ── Rotation ──────────────────────────────────────────────────────────────────
echo "[backup-db] Rotating: keeping last ${BACKUP_KEEP} backups..."
ls -t "${BACKUP_DIR}"/carbonthreat-*.sql.gz 2>/dev/null \
  | tail -n "+$((BACKUP_KEEP + 1))" \
  | xargs -r rm -v

echo "[backup-db] Done."
