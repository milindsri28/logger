import crypto from 'crypto';
import { config } from '../../config';
import { query, queryOne } from '../../config/database';
import { encrypt } from '../../utils/encryption';
import { RepositoryIntegration } from '../../types/agent';
import { OAuthAction, OAuthStatePayload } from '../../types/oauth';
import {
  buildGitHubAuthorizeUrl,
  computeTokenExpiry,
  exchangeGitHubCode,
  fetchGitHubUser,
  parseScopes,
} from './github.oauth';

function signState(payload: OAuthStatePayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', config.oauthStateSecret)
    .update(data)
    .digest('base64url');
  return `${data}.${sig}`;
}

export function createOAuthState(action: OAuthAction, userId?: string): string {
  const payload: OAuthStatePayload = {
    action,
    userId,
    nonce: crypto.randomBytes(16).toString('hex'),
  };
  return signState(payload);
}

export function verifyOAuthState(state: string): OAuthStatePayload {
  const [data, sig] = state.split('.');
  if (!data || !sig) throw new Error('Invalid OAuth state');

  const expected = crypto
    .createHmac('sha256', config.oauthStateSecret)
    .update(data)
    .digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('Invalid OAuth state signature');
  }

  return JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as OAuthStatePayload;
}

export function getGitHubAuthorizeRedirect(action: OAuthAction, userId?: string): string {
  const state = createOAuthState(action, userId);
  return buildGitHubAuthorizeUrl(state);
}

export async function handleGitHubCallback(code: string): Promise<{
  action: OAuthAction;
  userId?: string;
  accessToken: string;
  refreshToken: string | null;
  scopes: string[];
  expiresAt: Date | null;
  githubUser: Awaited<ReturnType<typeof fetchGitHubUser>>;
}> {
  const tokenData = await exchangeGitHubCode(code);
  const githubUser = await fetchGitHubUser(tokenData.access_token);

  return {
    action: 'login',
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? null,
    scopes: parseScopes(tokenData.scope),
    expiresAt: computeTokenExpiry(tokenData.expires_in),
    githubUser,
  };
}

export async function saveRepositoryIntegration(
  userId: string,
  githubUser: { id: number; login: string },
  accessToken: string,
  refreshToken: string | null,
  scopes: string[],
  expiresAt: Date | null
): Promise<RepositoryIntegration> {
  const accessEnc = encrypt(accessToken);
  const refreshEnc = refreshToken ? encrypt(refreshToken) : null;
  const accountId = String(githubUser.id);

  const existing = await queryOne<RepositoryIntegration>(
    `SELECT * FROM repository_integrations
     WHERE user_id = $1 AND provider = 'github' AND provider_account_id = $2`,
    [userId, accountId]
  );

  if (existing) {
    const updated = await queryOne<RepositoryIntegration>(
      `UPDATE repository_integrations SET
        provider_account_login = $1,
        access_token_enc = $2,
        refresh_token_enc = $3,
        scopes = $4,
        expires_at = $5,
        status = 'active',
        updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [githubUser.login, accessEnc, refreshEnc, scopes, expiresAt, existing.id]
    );
    if (!updated) throw new Error('Failed to update integration');
    return updated;
  }

  const created = await queryOne<RepositoryIntegration>(
    `INSERT INTO repository_integrations
      (user_id, provider, provider_account_id, provider_account_login,
       access_token_enc, refresh_token_enc, scopes, expires_at, status)
     VALUES ($1, 'github', $2, $3, $4, $5, $6, $7, 'active')
     RETURNING *`,
    [userId, accountId, githubUser.login, accessEnc, refreshEnc, scopes, expiresAt]
  );
  if (!created) throw new Error('Failed to create integration');
  return created;
}

export async function getActiveGitHubIntegration(
  userId: string
): Promise<RepositoryIntegration | null> {
  return queryOne<RepositoryIntegration>(
    `SELECT * FROM repository_integrations
     WHERE user_id = $1 AND provider = 'github' AND status = 'active'
     ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );
}

export async function disconnectGitHub(userId: string): Promise<void> {
  await query(
    `UPDATE repository_integrations SET status = 'revoked', updated_at = NOW()
     WHERE user_id = $1 AND provider = 'github' AND status = 'active'`,
    [userId]
  );
}

export async function processGitHubOAuthCallback(
  code: string,
  state: string
): Promise<{
  action: OAuthAction;
  userId?: string;
  accessToken: string;
  refreshToken: string | null;
  scopes: string[];
  expiresAt: Date | null;
  githubUser: Awaited<ReturnType<typeof fetchGitHubUser>>;
}> {
  const statePayload = verifyOAuthState(state);
  const tokenResult = await handleGitHubCallback(code);
  return { ...tokenResult, action: statePayload.action, userId: statePayload.userId };
}
