import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { runMigrations } from '../config/migrate';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function resetDb() {
  const databaseUrl =
    process.env.DATABASE_URL || 'postgresql://aidebug:aidebug_secret@localhost:5435/ai_debug';

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('Dropping public schema…');
    await pool.query('DROP SCHEMA public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.query('GRANT ALL ON SCHEMA public TO public');

    console.log('Running migrations…');
    await runMigrations(pool);
    console.log('Database reset complete. All users, agents, and repos removed.');
  } catch (err) {
    console.error('Reset failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetDb();
