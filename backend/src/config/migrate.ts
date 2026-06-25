import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { logger } from '../utils/logger';

const MIGRATIONS = [
  '001_initial.sql',
  '002_mvp.sql',
  '003_repository_intelligence.sql',
  '004_local_mvp.sql',
  '005_agent_incidents.sql',
  '006_agent_pm2.sql',
  '007_agent_system_services.sql',
];

function migrationsDir(): string {
  const candidates = [
    path.resolve(__dirname, '../../../database/migrations'),
    path.resolve(__dirname, '../../database/migrations'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}

export async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const usersExist = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    ) AS exists`
  );

  if (usersExist.rows[0]?.exists) {
    const initialApplied = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [
      '001_initial.sql',
    ]);
    if (!initialApplied.rowCount) {
      await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', ['001_initial.sql']);
      logger.info('MIGRATE', 'Marked 001_initial.sql as applied (existing database)');
    }
  }

  const dir = migrationsDir();
  for (const file of MIGRATIONS) {
    const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (applied.rowCount && applied.rowCount > 0) {
      continue;
    }

    const migrationPath = path.join(dir, file);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    logger.info('MIGRATE', `Applied ${file}`);
  }
}
