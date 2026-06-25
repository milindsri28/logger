import dotenv from 'dotenv';
import path from 'path';
import { logger } from '../utils/logger';

// Load from monorepo root (logger/.env), whether running from src/ or dist/
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const backendPort = parseInt(process.env.BACKEND_PORT || '4000', 10);
const backendUrl = (process.env.BACKEND_URL || `http://localhost:${backendPort}`).replace(/\/$/, '');
const publicBackendUrl = (process.env.PUBLIC_BACKEND_URL || backendUrl).replace(/\/$/, '');
const apiUrl = (process.env.API_URL || `${backendUrl}/api`).replace(/\/$/, '');
const wsUrl =
  process.env.WS_URL ||
  (publicBackendUrl.startsWith('https')
    ? `wss://${publicBackendUrl.replace(/^https:\/\//, '')}/agent/ws`
    : `ws://${publicBackendUrl.replace(/^http:\/\//, '')}/agent/ws`);
const installScriptUrl =
  process.env.INSTALL_SCRIPT_URL || `${publicBackendUrl}/agent/install.sh`;
const githubOAuthCallbackUrl =
  process.env.GITHUB_OAUTH_CALLBACK_URL ||
  `http://localhost:${backendPort}/api/oauth/github/callback`;

export const config = {
  port: backendPort,
  backendUrl,
  publicBackendUrl,
  apiUrl,
  wsUrl,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://aidebug:aidebug_secret@localhost:5432/ai_debug',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  reposDataDir: process.env.REPOS_DATA_DIR || './data/repos',
  githubOAuth: {
    clientId: process.env.GITHUB_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET || '',
    scopes: (process.env.GITHUB_OAUTH_SCOPES || 'read:user,user:email,repo').split(',').map((s) => s.trim()),
    callbackUrl: githubOAuthCallbackUrl,
  },
  agent: {
    jwtSecret: process.env.AGENT_JWT_SECRET || process.env.JWT_SECRET || 'dev-agent-secret-change-in-production',
    jwtExpiresIn: process.env.AGENT_JWT_EXPIRES_IN || '30d',
    tokenExpiryHours: parseInt(process.env.AGENT_TOKEN_EXPIRY_HOURS || '24', 10),
    installScriptUrl,
    heartbeatTimeoutSec: parseInt(process.env.AGENT_HEARTBEAT_TIMEOUT_SEC || '90', 10),
  },
  oauthStateSecret: process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET || 'dev-oauth-state-secret',
  llm: {
    provider: (process.env.LLM_PROVIDER || 'openai') as 'openai' | 'gemini',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4.1',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  },
};

if (!config.encryptionKey || config.encryptionKey.length !== 64) {
  logger.warn('CONFIG', 'ENCRYPTION_KEY must be 64 hex characters (32 bytes). Credential encryption will fail.');
}

if (!config.githubOAuth.clientId || !config.githubOAuth.clientSecret) {
  logger.warn('CONFIG', 'GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET are not set. GitHub OAuth will not work.');
}
