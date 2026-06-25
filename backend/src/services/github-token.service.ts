import { queryOne } from '../config/database';
import { decrypt } from '../utils/encryption';
import { getActiveGitHubIntegration } from './oauth/oauth.service';
import { getUserGithubTokenEnc } from './user.service';

export async function resolveGitHubAccessToken(userId: string): Promise<string | null> {
  const integration = await getActiveGitHubIntegration(userId);
  if (integration) {
    return decrypt(integration.access_token_enc);
  }

  const legacyEnc = await getUserGithubTokenEnc(userId);
  if (legacyEnc) {
    return decrypt(legacyEnc);
  }

  return null;
}

export async function requireGitHubAccessToken(userId: string): Promise<string> {
  const token = await resolveGitHubAccessToken(userId);
  if (!token) {
    throw new Error('GitHub not connected. Connect GitHub via OAuth first.');
  }
  return token;
}
