import { query } from '../config/database';
import { encrypt } from '../utils/encryption';

export async function getUserGithubTokenEnc(userId: string): Promise<string | null> {
  const result = await query<{ github_token_enc: string | null }>(
    'SELECT github_token_enc FROM users WHERE id = $1',
    [userId]
  );
  return result[0]?.github_token_enc ?? null;
}

export async function saveUserGithubToken(userId: string, token: string): Promise<void> {
  await query('UPDATE users SET github_token_enc = $1, updated_at = NOW() WHERE id = $2', [
    encrypt(token),
    userId,
  ]);
}
