import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { runMigrations } from '../config/migrate';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function migrate() {
  const databaseUrl =
    process.env.DATABASE_URL || 'postgresql://aidebug:aidebug_secret@localhost:5435/ai_debug';

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await runMigrations(pool);
    console.log('Migrations completed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
