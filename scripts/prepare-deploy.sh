#!/bin/bash

# Exit on any error
set -e

echo "========================================"
echo " Preparing CarbonThreat Deploy Bundle"
echo "========================================"

# Go to project root (assuming script is in scripts/)
cd "$(dirname "$0")/.."

BUNDLE_DIR="deploy-bundle"
IMAGE_NAME="carbonthreat:latest"
RELEASE_TAR="carbonthreat-release.tar.gz"

echo "1. Cleaning up previous builds..."
rm -rf "$BUNDLE_DIR" "$RELEASE_TAR"
mkdir -p "$BUNDLE_DIR"

echo "2. Building Docker image ($IMAGE_NAME)..."
docker build -t "$IMAGE_NAME" -f Dockerfile .

echo "3. Exporting Docker image to tarball (this may take a minute)..."
# Save and compress the image
docker save "$IMAGE_NAME" | gzip > "$BUNDLE_DIR/carbonthreat-image.tar.gz"

echo "4. Copying deployment files..."
# Create a modified docker-compose for the target server
# Replace the 'build:' block with 'image: carbonthreat:latest'
awk '
  /^  carbonthreat:/ { in_ct = 1; print; next }
  in_ct && /^    build:/ { in_build = 1; print "    image: carbonthreat:latest"; next }
  in_build && /^      context:/ { next }
  in_build && /^      dockerfile:/ { in_build = 0; next }
  { print }
' docker-compose.prod.yml > "$BUNDLE_DIR/docker-compose.yml"

# Copy environment example
cp example.env "$BUNDLE_DIR/.env.example"

# Copy Nginx config and scripts
cp -r nginx "$BUNDLE_DIR/"
cp -r scripts "$BUNDLE_DIR/"

echo "5. Creating final release archive..."
tar -czf "$RELEASE_TAR" -C "$BUNDLE_DIR" .

echo "6. Cleanup temporary bundle directory..."
rm -rf "$BUNDLE_DIR"

echo "========================================"
echo " Done! Created $RELEASE_TAR"
echo "========================================"
echo "To deploy on the new server:"
echo "  1. Copy $RELEASE_TAR to the server."
echo "  2. Extract: tar -xzf $RELEASE_TAR -C /path/to/deploy/dir"
echo "  3. Load image: docker load -i carbonthreat-image.tar.gz"
echo "  4. Setup env: cp .env.example .env (and edit .env)"
echo "  5. Start app: docker compose up -d"
echo "========================================"
