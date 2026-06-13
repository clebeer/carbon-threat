import db from '../db/knex.js';
import loggerHelper from './logger.helper.js';

const logger = loggerHelper.get('helpers/userStatus.helper.js');

/**
 * Resolve the current persisted auth state for an enterprise (local/SAML/api_key)
 * user by id.
 *
 * Returns:
 *   - the row { id, role, is_active } when the user exists in the `users` table
 *   - null when the id is absent or no matching row exists
 *
 * A null return for a present-but-unknown id is the signal that the caller is
 * dealing with a non-enterprise principal (e.g. a git-provider OAuth identity
 * that is not tracked in the `users` table) and should fall back to the claims
 * carried by the signed JWT.
 *
 * This is the single source of truth that lets the bearer middleware and the
 * refresh flow honour deactivation and role changes immediately, instead of
 * trusting the (up to 1-day-old) role/identity baked into the access token.
 */
async function getAuthState(id) {
  if (!id) {return null;}
  try {
    const row = await db('users').
      where({ id }).
      first('id', 'role', 'is_active');
    return row ?? null;
  } catch (err) {
    // Surface the failure to the caller so it can decide how to fail. We do not
    // silently treat a DB error as "user is fine".
    logger.error('getAuthState query failed', err);
    throw err;
  }
}

export default {
  getAuthState,
};
