import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Create a connection pool with production-ready settings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  maxUses: 7500,
});

// Create the drizzle database instance with schema
export const db = drizzle(pool, { schema });

// Export the pool for raw queries if needed
export { pool };

process.on('SIGINT', () => pool.end());
process.on('SIGTERM', () => pool.end());
