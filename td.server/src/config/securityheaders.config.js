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
    app.use(helmet.xssFilter());
    app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));
    app.use(helmet.permittedCrossDomainPolicies({ permittedPolicies: 'none' }));

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
                connectSrc:      ["'self'", 'ws:', 'wss:'],   // Yjs WebSocket
                imgSrc:          ["'self'", 'data:', 'blob:'],
                fontSrc:         ["'self'", 'https://fonts.gstatic.com', 'data:'],
                workerSrc:       ["'self'", 'blob:'],          // ReactFlow web workers
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
