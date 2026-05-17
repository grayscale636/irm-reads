import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Log only the first successful connection; subsequent ones (from pool churn)
// would otherwise spam the logs every time the pool spins up a fresh socket.
let connectedOnce = false;
pool.on('connect', () => {
  if (!connectedOnce) {
    connectedOnce = true;
    console.log('✅ Connected to PostgreSQL');
  }
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL error:', err);
});
