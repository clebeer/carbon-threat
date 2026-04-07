#!/usr/bin/env bash
# =============================================================================
# Generate self-signed TLS certificates for local development
#
# Usage:
#   ./scripts/gen-local-certs.sh
#
# Output: nginx/certs/fullchain.pem  nginx/certs/privkey.pem
# =============================================================================
set -euo pipefail

CERT_DIR="$(dirname "$0")/../nginx/certs"
mkdir -p "$CERT_DIR"

echo "[gen-local-certs] Generating self-signed certificate in $CERT_DIR ..."

openssl req -x509 \
  -newkey rsa:4096 \
  -keyout "$CERT_DIR/privkey.pem" \
  -out    "$CERT_DIR/fullchain.pem" \
  -days   365 \
  -nodes \
  -subj "/CN=localhost/O=CarbonThreat/C=BR" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

chmod 600 "$CERT_DIR/privkey.pem"
chmod 644 "$CERT_DIR/fullchain.pem"

echo "[gen-local-certs] Done."
echo "  cert: $CERT_DIR/fullchain.pem"
echo "  key:  $CERT_DIR/privkey.pem"
echo ""
echo "Add to your browser's trusted roots or use --insecure for curl."
