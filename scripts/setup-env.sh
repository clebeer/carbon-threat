#!/usr/bin/env bash
# =============================================================================
# CarbonThreat — Setup .env automatically
#
# Usage:
#   ./scripts/setup-env.sh          # generate .env from minimal.env
#   ./scripts/setup-env.sh --force  # overwrite .env without prompting
#   ./scripts/setup-env.sh --reset  # full reset: down -v + regenerate .env + up
#
# This script reads minimal.env (the template), replaces every GENERATE_*
# placeholder with a cryptographically secure value, and writes the result
# to .env — ready for `docker compose up`.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="$PROJECT_ROOT/.env"
TEMPLATE_FILE="$PROJECT_ROOT/minimal.env"

# ── Colours (disabled when not a terminal) ──────────────────────────────────
if [ -t 1 ]; then
    GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
else
    GREEN=''; YELLOW=''; RED=''; CYAN=''; NC=''
fi

# ── Helpers ─────────────────────────────────────────────────────────────────
info()  { printf "${GREEN}[INFO]${NC}  %s\n" "$*"; }
warn()  { printf "${YELLOW}[WARN]${NC}  %s\n" "$*"; }
error() { printf "${RED}[ERROR]${NC} %s\n" "$*" >&2; exit 1; }

# ── Parse arguments ─────────────────────────────────────────────────────────
FORCE=false
RESET=false
for arg in "$@"; do
    case "$arg" in
        --force) FORCE=true ;;
        --reset) RESET=true ;;
        *) warn "Unknown argument: $arg" ;;
    esac
done

# ── --reset: full teardown + regenerate + bring up ──────────────────────────
if [ "$RESET" = true ]; then
    info "🔄  Full reset requested"
    warn "This will STOP all containers and DELETE volumes (database data will be lost!)"

    if [ "$FORCE" != true ]; then
        printf "${CYAN}Proceed with full reset? [y/N]${NC} "
        read -r answer
        case "$answer" in
            [yY]|[yY][eE][sS]) ;;
            *) info "Aborted."; exit 0 ;;
        esac
    fi

    info "Stopping containers and removing volumes..."
    docker compose -f "$PROJECT_ROOT/docker-compose.yml" down -v 2>/dev/null || \
        warn "docker compose down -v failed (containers may not be running)"

    info "Volumes removed. Regenerating .env..."
    FORCE=true  # force overwrite since we're doing a full reset
fi

# ── Pre-flight checks ───────────────────────────────────────────────────────
if [ ! -f "$TEMPLATE_FILE" ]; then
    error "Template file not found: $TEMPLATE_FILE"
fi

# Check for openssl (required for secret generation)
if ! command -v openssl &>/dev/null; then
    error "openssl is required but not found in PATH. Install it and try again."
fi

# ── Handle existing .env ────────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
    if [ "$FORCE" != true ]; then
        warn ".env already exists at $ENV_FILE"
        printf "${CYAN}Overwrite? [y/N]${NC} "
        read -r answer
        case "$answer" in
            [yY]|[yY][eE][sS]) ;;
            *) info "Aborted — existing .env preserved."; exit 0 ;;
        esac
    fi
    info "Overwriting existing .env"
fi

# ── Generate secrets ────────────────────────────────────────────────────────
info "Generating cryptographically secure secrets..."

DB_PASSWORD=$(openssl rand -base64 24)
JWT_SIGNING_KEY=$(openssl rand -base64 48)
JWT_REFRESH_SIGNING_KEY=$(openssl rand -base64 48)
ENCRYPTION_KEY=$(openssl rand -hex 32)
# Legacy ENCRYPTION_KEYS value: exactly 32 characters
LEGACY_ENC_VAL=$(openssl rand -base64 24 | head -c 32)

# ── Build .env from template ────────────────────────────────────────────────
info "Building .env from $TEMPLATE_FILE"

cp "$TEMPLATE_FILE" "$ENV_FILE"

# Replace placeholders with generated values
sed -i.bak \
    -e "s|GENERATE_openssl_rand_base64_24_different_value|${JWT_REFRESH_SIGNING_KEY}|g" \
    -e "s|GENERATE_openssl_rand_base64_48_different_value|${JWT_REFRESH_SIGNING_KEY}|g" \
    -e "s|GENERATE_openssl_rand_base64_48|${JWT_SIGNING_KEY}|g" \
    -e "s|GENERATE_openssl_rand_base64_24|${DB_PASSWORD}|g" \
    -e "s|GENERATE_openssl_rand_hex_32|${ENCRYPTION_KEY}|g" \
    -e "s|GENERATE_32_chars_exactly_________|${LEGACY_ENC_VAL}|g" \
    "$ENV_FILE"

# Update DATABASE_URL to match generated credentials
sed -i.bak \
    -e "s|postgres://carbonthreat_user:[^@]*@|postgres://carbonthreat_user:${DB_PASSWORD}@|g" \
    "$ENV_FILE"

# Clean up sed backup file
rm -f "${ENV_FILE}.bak"

# ── Check for existing PostgreSQL volume conflict ───────────────────────────
PG_VOLUME_EXISTS=false
if command -v docker &>/dev/null; then
    # Get the compose project name from the directory name
    PROJECT_NAME="$(basename "$PROJECT_ROOT" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g')"
    if docker volume ls -q 2>/dev/null | grep -q "${PROJECT_NAME}_pgdata"; then
        PG_VOLUME_EXISTS=true
    fi
fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
info "✅  .env created successfully at $ENV_FILE"
echo ""
printf "  ${CYAN}%-40s${NC} %s\n" "DB_PASSWORD" "${DB_PASSWORD:0:8}..."
printf "  ${CYAN}%-40s${NC} %s\n" "ENCRYPTION_JWT_SIGNING_KEY" "${JWT_SIGNING_KEY:0:8}..."
printf "  ${CYAN}%-40s${NC} %s\n" "ENCRYPTION_JWT_REFRESH_SIGNING_KEY" "${JWT_REFRESH_SIGNING_KEY:0:8}..."
printf "  ${CYAN}%-40s${NC} %s\n" "ENCRYPTION_KEY" "${ENCRYPTION_KEY:0:8}..."
printf "  ${CYAN}%-40s${NC} %s\n" "ENCRYPTION_KEYS (legacy)" "${LEGACY_ENC_VAL:0:8}..."
echo ""

# ── Volume conflict warning ─────────────────────────────────────────────────
if [ "$PG_VOLUME_EXISTS" = true ] && [ "$RESET" != true ]; then
    echo ""
    warn "⚠️  PostgreSQL data volume (pgdata) already exists!"
    warn "   The new DB_PASSWORD will NOT match the password stored in the existing volume."
    warn "   This will cause 'password authentication failed' errors."
    echo ""
    warn "To fix, run one of:"
    echo "  ./scripts/setup-env.sh --reset        # full reset (deletes DB data)"
    echo "  docker compose down -v && docker compose up --build -d  # manual reset"
    echo ""
fi

# ── Auto-start after --reset ────────────────────────────────────────────────
if [ "$RESET" = true ]; then
    info "Starting the stack..."
    docker compose -f "$PROJECT_ROOT/docker-compose.yml" up --build -d
    info "✅  Stack is up! Check status with: docker compose logs -f"
    exit 0
fi

info "Next steps:"
echo "  1. Review .env and adjust APP_HOSTNAME, TLS settings, OAuth keys, etc."
echo "  2. Generate TLS certs (if APP_USE_TLS=true):  ./scripts/gen-local-certs.sh"
echo "  3. Start the stack:                           docker compose up --build -d"
echo ""
warn "⚠️  NEVER commit .env to version control!"
