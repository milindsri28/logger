import dotenv from 'dotenv';
import path from 'path';

// Load from monorepo root (logger/.env), whether running from src/ or dist/
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  port: parseInt(process.env.BACKEND_PORT || '4000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://aidebug:aidebug_secret@localhost:5432/ai_debug',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  reposDataDir: process.env.REPOS_DATA_DIR || './data/repos',
  llm: {
    provider: (process.env.LLM_PROVIDER || 'openai') as 'openai' | 'gemini',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4.1',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  },
};

if (!config.encryptionKey || config.encryptionKey.length !== 64) {
  console.warn('WARNING: ENCRYPTION_KEY must be 64 hex characters (32 bytes). Credential encryption will fail.');
}
