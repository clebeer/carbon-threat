import jsonwebtoken from 'jsonwebtoken';
import db from '../db/knex.js';
import jwtHelper from '../helpers/jwt.helper.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('repositories/token.js');

/**
 * Persists a refresh token to the database.
 * Expiry is read from the JWT payload so we can clean up stale rows.
 * @param {string} token
 */
const add = async (token) => {
  logger.debug('Adding refresh token to repository');
  try {
    const decoded = jsonwebtoken.decode(token);
    const expires_at = decoded?.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // fallback: 7 days

    await db('refresh_tokens').
      insert({ token, expires_at }).
      onConflict('token').
      ignore();
  } catch (err) {
    logger.error('Failed to store refresh token', err);
  }
};

/**
 * Removes a token from the store (i.e. invalidates it on logout).
 * @param {string} token
 */
const remove = async (token) => {
  logger.debug('Removing / invalidating refresh token from repository');
  try {
    await db('refresh_tokens').where({ token }).
delete();
  } catch (err) {
    logger.error('Failed to remove refresh token', err);
  }
};

/**
 * Verifies that a refresh token is present in the DB and cryptographically valid.
 * Expired rows are cleaned up opportunistically.
 * @param {string} token
 * @returns {Object|false} The decoded token body, or false.
 */
const verify = async (token) => {
  try {
    const row = await db('refresh_tokens').where({ token }).
first();

    if (!row) {
      logger.audit('Refresh token not found in repository');
      return false;
    }

    // Opportunistic cleanup of expired tokens
    if (new Date(row.expires_at) < new Date()) {
      await db('refresh_tokens').where({ token }).
delete();
      logger.audit('Refresh token expired');
      return false;
    }

    logger.debug('Refresh token verified');
    return jwtHelper.verifyRefresh(token);
  } catch (err) {
    logger.audit('Error verifying refresh token');
    logger.info(err);
    return false;
  }
};

export default {
  add,
  remove,
  verify
};
