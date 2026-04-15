import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import db from '../db/knex.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('auth/enterprise-sso.js');

export function setupAuth(app) {
  try {
    passport.use(new LocalStrategy(
      { usernameField: 'email', passwordField: 'password' },
      async (email, password, done) => {
        try {
          const user = await db('users')
            .where({ email: email.toLowerCase().trim(), is_active: true })
            .first();

          if (!user) {
            logger.warn(`Login attempt for unknown email: ${email}`);
            return done(null, false, { message: 'Invalid credentials.' });
          }

          const valid = await bcrypt.compare(password, user.password_hash);
          if (!valid) {
            logger.warn(`Failed login attempt for: ${email}`);
            return done(null, false, { message: 'Invalid credentials.' });
          }

          logger.info(`Successful local login for: ${email}`);
          return done(null, { id: user.id, email: user.email, role: user.role });
        } catch (err) {
          logger.error('Error during local authentication', err);
          return done(err);
        }
      }
    ));

    // Stateless JWT — session serialization not used, but passport requires these
    passport.serializeUser((user, done) => done(null, user.id));
    passport.deserializeUser(async (id, done) => {
      try {
        const user = await db('users').where({ id, is_active: true }).first();
        done(null, user ? { id: user.id, email: user.email, role: user.role } : false);
      } catch (err) {
        done(err);
      }
    });

    app.use(passport.initialize());
  } catch (error) {
    logger.error('Failed to configure Enterprise SSO', error);
  }
}
