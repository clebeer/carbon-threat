import errors from '../controllers/errors.js';
import jwt from '../helpers/jwt.helper.js';
import loggerHelper from '../helpers/logger.helper.js';
import userStatus from '../helpers/userStatus.helper.js';

const logger = loggerHelper.get('config/bearer.config.js');

/**
 * Extracts the bearer token from the auth header
 * Returns null if there is not a valid bearer token
 * @param {String} authHeader
 * @returns {String|null}
 */
const getBearerToken = (authHeader) => {
    if (!authHeader) {
        logger.info('Bearer token not found, auth header is empty');
        return null;
    }

    if (authHeader.indexOf('Bearer ') === -1) {
        logger.warn('Bearer token key word not found in auth header');
        return null;
    }

    return authHeader.split(' ')[1];
};

const middleware = async (req, res, next) => {
    const token = getBearerToken(req.headers.authorization);

    if (!token || token === 'null' || token === 'undefined') {
        logger.warn(`Bearer token not found or is undefined for resource that requires authentication: ${req.url}`);
        return errors.unauthorized(res, logger);
    }

    let user;
    let provider;
    try {
        ({ provider, user } = jwt.verifyToken(token));
    } catch (e) {
        if (e.name === 'TokenExpiredError') {
            logger.audit('Expired JWT encountered');
            return errors.unauthorized(res, logger);
        }

        logger.audit('Error decoding JWT');
        logger.error(e);
        return errors.badRequest('Invalid JWT', res, logger);
    }

    req.provider = provider;
    req.user = user;

    // Re-validate enterprise (local/SAML/api_key) principals against the DB on
    // every request so that deactivation and role changes take effect
    // immediately, rather than being trusted from the (up to 1-day-old) signed
    // access token. git-provider OAuth identities are not tracked in `users`
    // (getAuthState returns null) and keep their JWT-carried claims.
    if (user && user.id) {
        let authState;
        try {
            authState = await userStatus.getAuthState(user.id);
        } catch {
            // Fail closed: if we cannot confirm the account is still valid, deny.
            return errors.unauthorized(res, logger);
        }

        if (authState) {
            if (!authState.is_active) {
                logger.audit(`Rejected token for deactivated user ${user.id}`);
                return errors.unauthorized(res, logger);
            }
            // Trust the persisted role, not the role baked into the token.
            // eslint-disable-next-line require-atomic-updates -- single request per middleware invocation; no shared-state race
            req.user.role = authState.role;
        }
    }

    return next();
};

export default {
    middleware
};
