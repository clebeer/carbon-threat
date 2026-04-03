/**
 * SSO / SAML 2.0 authentication controller.
 *
 * Flows:
 *   GET  /api/auth/sso/saml          → redirect to IdP login page
 *   POST /api/auth/sso/saml/callback ← IdP posts SAML assertion here
 *   GET  /api/auth/sso/saml/metadata → expose SP metadata XML to IdP admins
 *
 * On successful assertion the user is upserted into the `users` table
 * (role defaults to 'viewer' on first login) and a JWT pair is issued,
 * compatible with the existing bearer.config.js middleware.
 */
import { Strategy as SamlStrategy } from 'passport-saml';
import passport from 'passport';
import db from '../db/knex.js';
import jwtHelper from '../helpers/jwt.helper.js';
import loggerHelper from '../helpers/logger.helper.js';
import { getSamlConfig, isSamlEnabled } from '../config/saml.config.js';

const logger = loggerHelper.get('controllers/auth.sso.js');

// ── Strategy initialisation (lazy — only if SAML env vars are present) ────

let _strategy = null;

function getStrategy() {
    if (_strategy) return _strategy;

    if (!isSamlEnabled()) {
        throw new Error('SAML is not configured. Set SAML_ENTRY_POINT, SAML_ISSUER, SAML_CERT and SAML_CALLBACK_URL.');
    }

    _strategy = new SamlStrategy(
        getSamlConfig(),
        async (profile, done) => {
            try {
                const email = (
                    profile.email ||
                    profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
                    profile.nameID
                )?.toLowerCase().trim();

                if (!email) return done(new Error('SAML assertion did not include an email claim'));

                const displayName =
                    profile.displayName ||
                    profile['http://schemas.microsoft.com/identity/claims/displayname'] ||
                    null;

                // Upsert: create on first login, update display_name thereafter
                let user = await db('users').where({ email, is_active: true }).first();

                if (!user) {
                    [user] = await db('users')
                        .insert({
                            email,
                            display_name: displayName,
                            // SSO users have no password_hash — they authenticate via IdP
                            password_hash: null,
                            role: 'viewer',
                        })
                        .returning(['id', 'email', 'role', 'org_id']);

                    logger.info(`SSO: new user provisioned: ${email}`);
                } else if (displayName && user.display_name !== displayName) {
                    await db('users').where({ id: user.id }).update({ display_name: displayName, updated_at: db.fn.now() });
                }

                db('users').where({ id: user.id }).update({ last_login_at: db.fn.now() }).catch(
                    (err) => logger.error('Failed to update last_login_at', err)
                );

                return done(null, { id: user.id, email: user.email, role: user.role });
            } catch (err) {
                logger.error('SAML strategy error', err);
                return done(err);
            }
        }
    );

    passport.use('saml', _strategy);
    return _strategy;
}

// ── Route handlers ─────────────────────────────────────────────────────────

/**
 * GET /api/auth/sso/saml
 * Redirects the browser to the IdP login page.
 */
export function samlLogin(req, res, next) {
    if (!isSamlEnabled()) {
        return res.status(503).json({ error: 'SAML SSO is not configured on this instance' });
    }
    getStrategy(); // ensure strategy is registered
    passport.authenticate('saml', { session: false })(req, res, next);
}

/**
 * POST /api/auth/sso/saml/callback
 * Handles the IdP assertion. Issues a JWT pair on success.
 */
export function samlCallback(req, res, next) {
    if (!isSamlEnabled()) {
        return res.status(503).json({ error: 'SAML SSO is not configured on this instance' });
    }

    getStrategy();

    passport.authenticate('saml', { session: false }, async (err, user) => {
        if (err) {
            logger.error('SAML callback error', err);
            return res.status(401).json({ error: 'SSO authentication failed' });
        }
        if (!user) {
            return res.status(401).json({ error: 'SSO authentication failed: no user returned' });
        }

        try {
            const { accessToken, refreshToken } = await jwtHelper.createAsync(
                'saml',
                { type: 'saml' },
                { id: user.id, email: user.email, role: user.role }
            );

            logger.info(`SSO login successful: ${user.email} (role=${user.role})`);

            // Redirect to the SPA with tokens as query params.
            // The frontend reads them once from the URL and stores them in memory/store,
            // then replaces the URL with history.replaceState to remove the tokens.
            const redirectUrl = new URL(process.env.SSO_REDIRECT_URL ?? '/');
            redirectUrl.searchParams.set('accessToken', accessToken);
            redirectUrl.searchParams.set('refreshToken', refreshToken);

            return res.redirect(redirectUrl.toString());
        } catch (jwtErr) {
            logger.error('JWT creation failed after SAML callback', jwtErr);
            return res.status(500).json({ error: 'Internal server error' });
        }
    })(req, res, next);
}

/**
 * GET /api/auth/sso/saml/metadata
 * Returns SP metadata XML. IdP admins use this to register CarbonThreat.
 */
export function samlMetadata(req, res) {
    if (!isSamlEnabled()) {
        return res.status(503).json({ error: 'SAML SSO is not configured on this instance' });
    }

    try {
        const strategy = getStrategy();
        const metadata = strategy.generateServiceProviderMetadata(null, null);
        res.type('application/xml');
        return res.send(metadata);
    } catch (err) {
        logger.error('Failed to generate SAML metadata', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
