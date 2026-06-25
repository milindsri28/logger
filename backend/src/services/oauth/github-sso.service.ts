import crypto from 'crypto';
import { hashPassword, signToken, sanitizeUser } from '../auth.service';
import { findByEmail, findByGithubId, linkGithubId, createOAuthUser } from '../user.service';
import { saveRepositoryIntegration } from './oauth.service';
import { GitHubUser } from '../../types/oauth';

function randomUnusablePassword(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function loginOrRegisterWithGitHub(
  githubUser: GitHubUser,
  accessToken: string,
  refreshToken: string | null,
  scopes: string[],
  expiresAt: Date | null
): Promise<{ token: string; user: ReturnType<typeof sanitizeUser> }> {
  const githubId = String(githubUser.id);

  let user = await findByGithubId(githubId);

  if (!user && githubUser.email) {
    user = await findByEmail(githubUser.email);
    if (user && !user.github_id) {
      await linkGithubId(user.id, githubId);
    }
  }

  if (!user) {
    const email = githubUser.email || `${githubUser.login}@users.noreply.github.com`;
    const passwordHash = await hashPassword(randomUnusablePassword());
    user = await createOAuthUser(email, githubUser.name, githubId, passwordHash);
  }

  await saveRepositoryIntegration(user.id, githubUser, accessToken, refreshToken, scopes, expiresAt);

  const token = signToken({ userId: user.id, email: user.email });
  return { token, user: sanitizeUser(user) };
}

export async function connectGitHubForUser(
  userId: string,
  githubUser: GitHubUser,
  accessToken: string,
  refreshToken: string | null,
  scopes: string[],
  expiresAt: Date | null
): Promise<void> {
  await saveRepositoryIntegration(userId, githubUser, accessToken, refreshToken, scopes, expiresAt);
  await linkGithubId(userId, String(githubUser.id));
}
