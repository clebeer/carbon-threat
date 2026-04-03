import { Pool } from 'pg';

// Credentials are required at runtime — skip validation in test env (tests stub the query fn)
const requiredVars = ['DB_USER', 'DB_PASSWORD'];
if (process.env.NODE_ENV !== 'test' && !process.env.DATABASE_URL) {
  for (const key of requiredVars) {
    if (!process.env[key]) {
      throw new Error(
        `Required environment variable ${key} is not set. ` +
        'Copy example.env to .env and fill in all required values.'
      );
    }
  }
}

const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432', 10),
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME    || 'carbonthreat',
    };

const pool = new Pool({
  ...poolConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();
export default pool;
