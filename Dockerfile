# =============================================================================
# CarbonThreat — Multi-stage Docker build
#
# Stage 1 (build): installs all deps, compiles React SPA + transpiles server
# Stage 2 (runtime): prod-only deps + artefacts; ~half the image size
# =============================================================================

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Copy manifests first (better layer caching)
COPY package.json package-lock.json* ./
COPY td.server/package.json td.server/package-lock.json* ./td.server/
COPY ct.client/package.json ct.client/package-lock.json* ./ct.client/

# Install all dependencies
RUN npm install --ignore-scripts --legacy-peer-deps
RUN cd td.server && npm install --legacy-peer-deps
RUN cd ct.client && npm install --legacy-peer-deps

# Copy source trees
COPY td.server/ ./td.server/
COPY ct.client/ ./ct.client/

# Build React SPA → ct.client/dist
RUN cd ct.client && npm run build

# Transpile Express server → td.server/dist
RUN cd td.server && npm run build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# git + ca-certificates are required by the OSV Scanner's Git Repository scan feature.
# ca-certificates provides the root CA bundle that git/curl needs for HTTPS clones.
RUN apk add --no-cache git ca-certificates && update-ca-certificates

# Production-only server deps
COPY td.server/package.json td.server/package-lock.json* ./td.server/
RUN cd td.server && npm install --omit=dev

# Transpiled server + production entry point
COPY td.server/server.js ./td.server/server.js
COPY --from=build /app/td.server/dist ./td.server/dist

# Pre-compiled rule engine (lives outside src/ — must be copied explicitly)
COPY td.server/engine/ ./td.server/engine/

# Built React SPA — served as static files from /app/dist
COPY --from=build /app/ct.client/dist ./dist

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "td.server/server.js"]
