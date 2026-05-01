#!/usr/bin/env bash
# =============================================================================
# CarbonThreat — Setup .env automatically
#
# Usage:
#   ./scripts/setup-env.sh          # generate .env from minimal.env
#   ./scripts/setup-env.sh --force  # overwrite .env without prompting
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
    if [ "${1:-}" != "--force" ]; then
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
info "Next steps:"
echo "  1. Review .env and adjust APP_HOSTNAME, TLS settings, OAuth keys, etc."
echo "  2. Generate TLS certs (if APP_USE_TLS=true):  ./scripts/gen-local-certs.sh"
echo "  3. Start the stack:                           docker compose up --build -d"
echo ""
warn "⚠️  NEVER commit .env to version control!"