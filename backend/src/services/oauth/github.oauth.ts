import crypto from 'crypto';
import { config } from '../../config';
import { GitHubTokenResponse, GitHubUser } from '../../types/oauth';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export function buildGitHubAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.githubOAuth.clientId,
    redirect_uri: config.githubOAuth.callbackUrl,
    scope: config.githubOAuth.scopes.join(' '),
    state,
  });
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeGitHubCode(code: string): Promise<GitHubTokenResponse> {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.githubOAuth.clientId,
      client_secret: config.githubOAuth.clientSecret,
      code,
      redirect_uri: config.githubOAuth.callbackUrl,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub token exchange failed: ${text}`);
  }

  const data = (await res.json()) as GitHubTokenResponse & { error?: string; error_description?: string };
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }
  return data;
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const res = await fetch('https://api.github.com/user', {
    headers: githubHeaders(accessToken),
  });
  if (!res.ok) throw new Error('Failed to fetch GitHub user');

  const user = (await res.json()) as GitHubUser;

  if (!user.email) {
    const emailRes = await fetch('https://api.github.com/user/emails', {
      headers: githubHeaders(accessToken),
    });
    if (emailRes.ok) {
      const emails = (await emailRes.json()) as { email: string; primary: boolean; verified: boolean }[];
      const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified);
      if (primary) user.email = primary.email;
    }
  }

  return user;
}

export function parseScopes(scopeHeader?: string): string[] {
  if (!scopeHeader) return [];
  return scopeHeader.split(/[,\s]+/).filter(Boolean);
}

export function computeTokenExpiry(expiresIn?: number): Date | null {
  if (!expiresIn) return null;
  return new Date(Date.now() + expiresIn * 1000);
}
