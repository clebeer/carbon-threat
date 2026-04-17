import crypto from 'crypto';
import helmet from 'helmet';

/**
 * CSP nonce middleware.
 *
 * Generates a per-request cryptographically-random nonce and attaches it to
 * res.locals.cspNonce so that server-rendered HTML (homeController) can inject
 * it as <script nonce="…"> / <style nonce="…">.
 *
 * This allows 'nonce-<value>' in scriptSrc / styleSrc instead of 'unsafe-inline'
 * for any elements we can explicitly tag — providing defence-in-depth even while
 * 'unsafe-inline' is still required for ReactFlow's runtime <style> injection.
 */
export function cspNonce(_req, res, next) {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
    next();
}

const config = (app, forceSecure) => {
    app.set('x-powered-by', false);

    // Attach nonce before CSP middleware so the directive factory can read it
    app.use(cspNonce);

    const ninetyDaysInSeconds = 7776000;
    app.use(helmet.hsts({ maxAge: ninetyDaysInSeconds, force: forceSecure, includeSubDomains: false }));
    app.use(helmet.frameguard({ action: 'deny' }));
    app.use(helmet.hidePoweredBy());
    app.use(helmet.noSniff());
    // helmet.xssFilter() is deprecated — the X-XSS-Protection header is unsafe
    // on modern browsers and has been removed from the OWASP guidance. CSP
    // (configured below) is the proper replacement.
    app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));
    app.use(helmet.permittedCrossDomainPolicies({ permittedPolicies: 'none' }));

    // Build the connect-src allowlist. In production we restrict WebSocket
    // targets to the configured app origin so a successful XSS cannot exfiltrate
    // data to an attacker-controlled ws:// endpoint.
    const appOrigin = process.env.APP_ORIGIN; // e.g. https://app.example.com
    const wsAllow = [];
    if (appOrigin) {
        try {
            const u = new URL(appOrigin);
            const wsScheme = u.protocol === 'https:' ? 'wss:' : 'ws:';
            wsAllow.push(`${wsScheme}//${u.host}`);
        } catch {
            // invalid APP_ORIGIN — fall through to the permissive default below
        }
    }
    if (wsAllow.length === 0) {
        // Dev/local fallback: keep the old permissive rule so contributors aren't
        // blocked when running on localhost without APP_ORIGIN configured.
        wsAllow.push('ws:', 'wss:');
    }

    app.use(
        helmet.contentSecurityPolicy({
            useDefaults: false,
            directives: {
                // ── Scripts ────────────────────────────────────────────────────────
                // 'self' + per-request nonce. No unsafe-eval, no unsafe-inline.
                // Vite production build emits no inline scripts.
                scriptSrc: [
                    "'self'",
                    (_req, res) => `'nonce-${res.locals.cspNonce}'`,
                ],

                // ── Styles ─────────────────────────────────────────────────────────
                // ReactFlow injects <style> tags at runtime — unsafe-inline required.
                // Nonce also included for explicitly-tagged elements; removing
                // unsafe-inline is the next hardening step once ReactFlow is verified
                // not to inject styles in production builds.
                styleSrc: [
                    "'self'",
                    'https://fonts.googleapis.com',
                    (_req, res) => `'nonce-${res.locals.cspNonce}'`,
                    "'unsafe-inline'",
                ],

                // style="" attributes (React style prop → HTML attribute) are governed
                // by style-src-attr, not styleSrc. Explicit 'unsafe-inline' is correct
                // here; HTML attribute injection cannot execute scripts.
                'style-src-attr': ["'unsafe-inline'"],

                // ── Other directives ───────────────────────────────────────────────
                defaultSrc:      ["'none'"],
                connectSrc:      ["'self'", ...wsAllow], // Yjs WebSocket (restricted in prod via APP_ORIGIN)
                imgSrc:          ["'self'", 'data:', 'blob:'],
                fontSrc:         ["'self'", 'https://fonts.gstatic.com', 'data:'],
                workerSrc:       ["'self'", 'blob:'], // ReactFlow web workers
                formAction:      ["'self'"],
                frameAncestors:  ["'none'"],
                upgradeInsecureRequests: [],

                // CSP violation reporting — allows monitoring and progressive tightening
                reportUri: ['/api/csp-report'],
            },
        })
    );
};

export default {
    config,
    cspNonce,
};
