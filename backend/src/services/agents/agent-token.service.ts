import crypto from 'crypto';
import { config } from '../../config';
import { pool, query, queryOne } from '../../config/database';
import { AgentToken } from '../../types/agent';
import { ApiError } from '../../utils/api-error';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateAgentTokenValue(): string {
  return `agent_${crypto.randomBytes(24).toString('hex')}`;
}

export async function createAgentToken(
  userId: string,
  label: string
): Promise<{ token: AgentToken; plainToken: string; installCommand: string }> {
  const plainToken = generateAgentTokenValue();
  const tokenHash = hashToken(plainToken);
  const expiresAt = new Date(Date.now() + config.agent.tokenExpiryHours * 60 * 60 * 1000);

  const token = await queryOne<AgentToken>(
    `INSERT INTO agent_tokens (user_id, token_hash, label, expires_at)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, tokenHash, label, expiresAt]
  );
  if (!token) throw new Error('Failed to create agent token');

  const installCommand = buildInstallCommand(plainToken);

  return { token, plainToken, installCommand };
}

function installEnvPrefix(): string {
  const backend = config.publicBackendUrl;
  if (backend === config.backendUrl) {
    return '';
  }
  return `export BACKEND_URL=${backend} WS_URL=${config.wsUrl} && `;
}

export function buildInstallCommand(plainToken: string): string {
  return `${installEnvPrefix()}curl -fsSL ${config.agent.installScriptUrl} | bash -s -- ${plainToken}`;
}

export async function validateAgentToken(
  plainToken: string
): Promise<{ token: AgentToken; userId: string }> {
  const tokenHash = hashToken(plainToken);
  const row = await queryOne<AgentToken>(
    `SELECT * FROM agent_tokens
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
    [tokenHash]
  );

  if (!row) {
    throw new ApiError('INVALID_TOKEN', 'Invalid or expired agent token', 401);
  }

  if (row.used_at) {
    throw new ApiError('INVALID_TOKEN', 'Agent token already used', 409);
  }

  return { token: row, userId: row.user_id };
}

/** @deprecated Use registerAgent transaction flow instead */
export async function validateAndConsumeAgentToken(
  plainToken: string
): Promise<{ token: AgentToken; userId: string }> {
  const { token, userId } = await validateAgentToken(plainToken);
  await query('UPDATE agent_tokens SET used_at = NOW() WHERE id = $1', [token.id]);
  return { token, userId };
}
