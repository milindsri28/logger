import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const MIGRATIONS = ['001_initial.sql', '002_mvp.sql'];

async function migrate() {
  const databaseUrl =
    process.env.DATABASE_URL || 'postgresql://aidebug:aidebug_secret@localhost:5433/ai_debug';

  const pool = new Pool({ connectionString: databaseUrl });

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
      console.log('Marked 001_initial.sql as applied (existing database)');
    }
  }

  try {
    for (const file of MIGRATIONS) {
      const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
      if (applied.rowCount && applied.rowCount > 0) {
        console.log(`Skipping ${file} (already applied)`);
        continue;
      }

      const migrationPath = path.resolve(__dirname, '../../../database/migrations', file);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      console.log(`Applied ${file}`);
    }
    console.log('Migrations completed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
