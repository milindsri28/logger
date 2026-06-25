import crypto from 'crypto';
import { query, queryOne } from '../config/database';
import { encrypt } from '../utils/encryption';
import { User } from '../types';

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

export async function findByGithubId(githubId: string): Promise<User | null> {
  return queryOne<User>('SELECT * FROM users WHERE github_id = $1', [githubId]);
}

export async function findByEmail(email: string): Promise<User | null> {
  return queryOne<User>('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
}

export async function linkGithubId(userId: string, githubId: string): Promise<void> {
  await query('UPDATE users SET github_id = $1, updated_at = NOW() WHERE id = $2', [
    githubId,
    userId,
  ]);
}

export async function createOAuthUser(
  email: string,
  name: string | null,
  githubId: string,
  passwordHash: string
): Promise<User> {
  const user = await queryOne<User>(
    `INSERT INTO users (email, password_hash, name, github_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [email.toLowerCase(), passwordHash, name, githubId]
  );
  if (!user) throw new Error('Failed to create user');
  return user;
}
