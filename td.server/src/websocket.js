import WebSocket from 'ws';
import yjsConfig from 'y-websocket/bin/utils.js';
import jsonwebtoken from 'jsonwebtoken';
import loggerHelper from './helpers/logger.helper.js';

const { setupWSConnection } = yjsConfig;
const logger = loggerHelper.get('websocket.js');

// ── Token extraction & validation ─────────────────────────────────────────────

function extractToken(req) {
  // 1. Query-param: ws://host/doc?token=<jwt>  (primary — easy for WS clients)
  const url = req.url ? new URL(req.url, 'http://localhost') : null;
  const queryToken = url ? url.searchParams.get('token') : null;
  if (queryToken) return queryToken;

  // 2. Authorization header: "Bearer <jwt>"  (preferred for native WS libs)
  const authHeader = req.headers && req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

function validateToken(token) {
  const signingKey = process.env.ENCRYPTION_JWT_SIGNING_KEY;
  if (!signingKey) {
    logger.error('ENCRYPTION_JWT_SIGNING_KEY not configured — WebSocket auth cannot proceed');
    return null;
  }
  try {
    return jsonwebtoken.verify(token, signingKey);
  } catch (err) {
    logger.warn(`WebSocket token validation failed: ${err.message}`);
    return null;
  }
}

// ── Per-IP rate limiting ──────────────────────────────────────────────────────
//
// Prevents connection-flood / resource-exhaustion attacks.
// A single IP is allowed at most MAX_CONNS_PER_IP simultaneous open connections
// and at most MAX_HANDSHAKES_PER_WINDOW new connections within WINDOW_MS.

const MAX_CONNS_PER_IP      = 10;   // concurrent open connections per IP
const MAX_HANDSHAKES_PER_WINDOW = 30;   // new connections per IP within window
const WINDOW_MS             = 60_000; // 1 minute sliding window

// Maps IP → { count: number (open connections), timestamps: number[] }
const connState = new Map();

function getIp(req) {
  // Respect X-Forwarded-For when behind a trusted proxy (app.set('trust proxy', true))
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  return (forwarded ? forwarded.split(',')[0].trim() : null)
    || req.socket?.remoteAddress
    || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const state = connState.get(ip) || { open: 0, timestamps: [] };

  // Evict timestamps outside the sliding window
  state.timestamps = state.timestamps.filter((t) => now - t < WINDOW_MS);

  // Check concurrent open connections
  if (state.open >= MAX_CONNS_PER_IP) {
    logger.warn(`[WS] Rate limit: ${ip} has ${state.open} concurrent connections (max ${MAX_CONNS_PER_IP})`);
    return true;
  }

  // Check new-connection rate
  if (state.timestamps.length >= MAX_HANDSHAKES_PER_WINDOW) {
    logger.warn(`[WS] Rate limit: ${ip} made ${state.timestamps.length} connections in ${WINDOW_MS / 1000}s (max ${MAX_HANDSHAKES_PER_WINDOW})`);
    return true;
  }

  state.timestamps.push(now);
  state.open = (state.open || 0) + 1;
  connState.set(ip, state);
  return false;
}

function releaseConn(ip) {
  const state = connState.get(ip);
  if (!state) return;
  state.open = Math.max(0, state.open - 1);
  if (state.open === 0 && state.timestamps.length === 0) {
    connState.delete(ip);
  } else {
    connState.set(ip, state);
  }
}

// Periodically clean up stale IP entries to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, state] of connState.entries()) {
    const freshTimestamps = state.timestamps.filter((t) => now - t < WINDOW_MS);
    if (freshTimestamps.length === 0 && state.open === 0) {
      connState.delete(ip);
    } else {
      state.timestamps = freshTimestamps;
      connState.set(ip, state);
    }
  }
}, WINDOW_MS).unref(); // .unref() so the interval doesn't prevent process exit

// ── WebSocket server ──────────────────────────────────────────────────────────

export function startWebsocketServer(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const ip = getIp(req);

    // 1. Rate limit check
    if (isRateLimited(ip)) {
      ws.close(4029, 'Too Many Requests');
      return;
    }

    // Track open connection; release on close regardless of auth outcome
    ws.on('close', () => {
      releaseConn(ip);
      const docName = ws._ctDocName || '(unknown)';
      logger.debug(`[Yjs] User disconnected from document: ${docName}`);
    });

    // 2. Authentication
    const token = extractToken(req);
    if (!token) {
      logger.warn(`[WS] Connection rejected from ${ip}: missing token`);
      ws.close(4001, 'Unauthorized: missing token');
      return;
    }

    const payload = validateToken(token);
    if (!payload) {
      logger.warn(`[WS] Connection rejected from ${ip}: invalid or expired token`);
      ws.close(4003, 'Forbidden: invalid or expired token');
      return;
    }

    // 3. Resolve document name from URL path  (e.g. /ws/tm-uuid → 'tm-uuid')
    const currentURL = req.url ? new URL(req.url, 'http://localhost') : null;
    const docName = currentURL
      ? currentURL.pathname.replace(/^\/+/, '').split('?')[0] || 'carbonthreat'
      : 'carbonthreat';

    ws._ctDocName = docName; // stored for the close handler above

    setupWSConnection(ws, req, { docName });
    logger.info(`[Yjs] ${payload.user?.email ?? payload.sub ?? 'user'} connected to document: ${docName} (ip=${ip})`);
  });

  return wss;
}
