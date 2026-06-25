import fs from 'fs/promises';
import path from 'path';
import simpleGit from 'simple-git';
import { config } from '../config';
import { query, queryOne } from '../config/database';
import { encrypt, decrypt } from '../utils/encryption';
import { Repository, RelevantCommit } from '../types';
import { indexRepository, updateIndexStatus } from './code-index.service';
import { getUserGithubTokenEnc, saveUserGithubToken } from './user.service';
import { requireGitHubAccessToken } from './github-token.service';
import { ApiError } from '../utils/api-error';

export function parseRepoUrl(url: string): { owner: string; name: string } {
  const cleaned = url.replace(/\.git$/, '').replace(/\/$/, '');
  const match = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)/);
  if (!match) throw new Error('Invalid GitHub repository URL');
  return { owner: match[1], name: match[2] };
}

export async function validateGitHubToken(token: string): Promise<{ login: string }> {
  const res = await fetch('https://api.github.com/user', {
    headers: githubHeaders(token),
  });
  if (!res.ok) throw new Error('Invalid GitHub token');
  return res.json() as Promise<{ login: string }>;
}

export async function validateRepoAccess(
  owner: string,
  name: string,
  token: string
): Promise<{ defaultBranch: string; private: boolean }> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
    headers: githubHeaders(token),
  });

  if (res.status === 404) {
    throw new Error(`Repository ${owner}/${name} not found or token has no access`);
  }
  if (res.status === 403) {
    throw new Error(
      'GitHub token cannot access this repository. For private repos use a classic PAT with "repo" scope, or a fine-grained PAT with Contents: Read on this repository.'
    );
  }
  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status}) when checking repository access`);
  }

  const data = await res.json() as { default_branch: string; private: boolean };
  return { defaultBranch: data.default_branch || 'main', private: data.private };
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function bareRepoUrl(owner: string, name: string): string {
  return `https://github.com/${owner}/${name}.git`;
}

/** Git HTTPS auth — GitHub requires Basic (not Bearer) for clone/fetch/pull. */
function gitWithAuth(token: string, cwd?: string) {
  const basic = Buffer.from(`x-access-token:${token}`).toString('base64');
  return simpleGit({
    baseDir: cwd,
    config: [`http.extraHeader=Authorization: Basic ${basic}`],
  });
}

export async function connectGitHub(userId: string, githubToken: string): Promise<{ login: string }> {
  const user = await validateGitHubToken(githubToken);
  await saveUserGithubToken(userId, githubToken);
  return user;
}

async function resolveGitHubToken(userId: string, githubToken?: string): Promise<string> {
  if (githubToken) return githubToken;
  try {
    return await requireGitHubAccessToken(userId);
  } catch {
    throw new ApiError('INVALID_TOKEN', 'GitHub token required. Connect GitHub first.');
  }
}

export async function addRepository(
  userId: string,
  repoUrl: string,
  githubToken?: string
): Promise<Repository> {
  const token = await resolveGitHubToken(userId, githubToken);
  await validateGitHubToken(token);
  const { owner, name } = parseRepoUrl(repoUrl);

  const existing = await queryOne<Repository>(
    'SELECT * FROM repositories WHERE user_id = $1 AND owner = $2 AND name = $3',
    [userId, owner, name]
  );
  if (existing) throw new Error('Repository already connected');

  const { defaultBranch } = await validateRepoAccess(owner, name, token);
  const localPath = path.join(config.reposDataDir, userId, `${owner}_${name}`);

  const repo = await queryOne<Repository>(
    `INSERT INTO repositories (user_id, github_token_enc, repo_url, owner, name, default_branch, local_path, clone_status, index_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'pending') RETURNING *`,
    [userId, encrypt(token), repoUrl, owner, name, defaultBranch, localPath]
  );
  if (!repo) throw new Error('Failed to create repository record');

  cloneAndIndex(repo).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Clone/index failed for ${repo.id}: ${message.replace(/github_pat_[^\s]+/g, '[REDACTED]').replace(/ghp_[^\s]+/g, '[REDACTED]')}`);
  });

  return repo;
}

export async function cloneAndIndex(repo: Repository): Promise<void> {
  await query('UPDATE repositories SET clone_status = $1, failure_reason = NULL WHERE id = $2', [
    'cloning',
    repo.id,
  ]);

  const token = decrypt(repo.github_token_enc);
  const repoUrl = bareRepoUrl(repo.owner, repo.name);

  await fs.mkdir(path.dirname(repo.local_path!), { recursive: true });

  try {
    const git = gitWithAuth(token);
    if (await pathExists(repo.local_path!)) {
      const localGit = gitWithAuth(token, repo.local_path!);
      await localGit.fetch('origin');
      await localGit.checkout(repo.default_branch);
      await localGit.pull('origin', repo.default_branch);
    } else {
      await git.clone(repoUrl, repo.local_path!, ['--depth', '50']);
    }
    await query('UPDATE repositories SET clone_status = $1 WHERE id = $2', ['ready', repo.id]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await fs.rm(repo.local_path!, { recursive: true, force: true }).catch(() => {});
    await query(
      'UPDATE repositories SET clone_status = $1, failure_reason = $2 WHERE id = $3',
      ['failed', message.slice(0, 500), repo.id]
    );
    throw err;
  }

  await updateIndexStatus(repo.id, 'indexing');
  try {
    await indexRepository(repo);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await query(
      'UPDATE repositories SET index_status = $1, failure_reason = $2 WHERE id = $3',
      ['failed', message.slice(0, 500), repo.id]
    );
    throw err;
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function getRepositories(userId: string): Promise<Repository[]> {
  return query<Repository>('SELECT * FROM repositories WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
}

export interface AvailableGitHubRepo {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  htmlUrl: string;
  private: boolean;
  defaultBranch: string;
  connected: boolean;
}

export async function listAvailableGitHubRepos(userId: string): Promise<AvailableGitHubRepo[]> {
  const token = await requireGitHubAccessToken(userId);
  const connected = await getRepositories(userId);
  const connectedSet = new Set(connected.map((r) => `${r.owner}/${r.name}`));

  const repos: AvailableGitHubRepo[] = [];
  let page = 1;

  while (page <= 10) {
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
      { headers: githubHeaders(token) }
    );

    if (!res.ok) {
      throw new Error(`GitHub API error (${res.status}) when listing repositories`);
    }

    const data = (await res.json()) as Array<{
      id: number;
      full_name: string;
      owner: { login: string };
      name: string;
      html_url: string;
      private: boolean;
      default_branch?: string;
    }>;

    if (data.length === 0) break;

    for (const repo of data) {
      repos.push({
        id: repo.id,
        fullName: repo.full_name,
        owner: repo.owner.login,
        name: repo.name,
        htmlUrl: repo.html_url,
        private: repo.private,
        defaultBranch: repo.default_branch || 'main',
        connected: connectedSet.has(repo.full_name),
      });
    }

    if (data.length < 100) break;
    page += 1;
  }

  return repos;
}

export async function connectRepositories(
  userId: string,
  repoUrls: string[]
): Promise<{
  connected: Array<{ id: string; owner: string; name: string; repoUrl: string }>;
  errors: Array<{ repoUrl: string; message: string }>;
}> {
  const connected: Array<{ id: string; owner: string; name: string; repoUrl: string }> = [];
  const errors: Array<{ repoUrl: string; message: string }> = [];

  for (const repoUrl of repoUrls) {
    try {
      const repo = await addRepository(userId, repoUrl);
      connected.push({
        id: repo.id,
        owner: repo.owner,
        name: repo.name,
        repoUrl: repo.repo_url,
      });
    } catch (err) {
      errors.push({
        repoUrl,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { connected, errors };
}

export async function getRepository(userId: string, repoId: string): Promise<Repository | null> {
  return queryOne<Repository>('SELECT * FROM repositories WHERE id = $1 AND user_id = $2', [repoId, userId]);
}

export async function deleteRepository(userId: string, repoId: string): Promise<void> {
  const repo = await getRepository(userId, repoId);
  if (!repo) throw new Error('Repository not found');
  if (repo.local_path) {
    await fs.rm(repo.local_path, { recursive: true, force: true }).catch(() => {});
  }
  await query('DELETE FROM repositories WHERE id = $1', [repoId]);
}

export async function syncRepository(userId: string, repoId: string): Promise<Repository> {
  const repo = await getRepository(userId, repoId);
  if (!repo) throw new Error('Repository not found');
  cloneAndIndex(repo).catch(console.error);
  return repo;
}

export async function getCommitsForFiles(
  repo: Repository,
  filePaths: string[],
  limit = 10
): Promise<RelevantCommit[]> {
  const token = decrypt(repo.github_token_enc);
  const commits: RelevantCommit[] = [];
  const seen = new Set<string>();

  for (const filePath of filePaths.slice(0, 5)) {
    const res = await fetch(
      `https://api.github.com/repos/${repo.owner}/${repo.name}/commits?path=${encodeURIComponent(filePath)}&per_page=5`,
      {
        headers: githubHeaders(token),
      }
    );
    if (!res.ok) continue;
    const data = await res.json() as Array<{
      sha: string;
      commit: { message: string; author: { name: string; date: string } };
    }>;
    for (const c of data) {
      if (!seen.has(c.sha)) {
        seen.add(c.sha);
        commits.push({
          sha: c.sha.slice(0, 7),
          message: c.commit.message.split('\n')[0],
          author: c.commit.author.name,
          date: c.commit.author.date,
        });
      }
    }
  }

  return commits.slice(0, limit);
}

export async function getRecentCommits(repo: Repository, limit = 20): Promise<RelevantCommit[]> {
  const token = decrypt(repo.github_token_enc);
  const branch = await getCurrentBranch(repo);
  const res = await fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.name}/commits?per_page=${Math.min(limit, 100)}&sha=${encodeURIComponent(branch)}`,
    { headers: githubHeaders(token) }
  );
  if (!res.ok) return [];

  const data = await res.json() as Array<{
    sha: string;
    html_url: string;
    commit: { message: string; author: { name: string; date: string } };
  }>;

  return data.map((c) => ({
    sha: c.sha.slice(0, 7),
    fullSha: c.sha,
    message: c.commit.message.split('\n')[0],
    author: c.commit.author.name,
    date: c.commit.author.date,
    url: c.html_url,
  }));
}

export interface RelevantFile {
  path: string;
  changeCount: number;
  lastModified?: string;
}

export async function getRelevantFiles(repo: Repository, limit = 15): Promise<RelevantFile[]> {
  if (repo.local_path && (await pathExists(repo.local_path))) {
    try {
      const git = simpleGit(repo.local_path);
      const raw = await git.raw(['log', '--name-only', '--pretty=format:', '-50']);
      const counts = new Map<string, number>();

      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.includes('node_modules') || trimmed.startsWith('.')) continue;
        counts.set(trimmed, (counts.get(trimmed) || 0) + 1);
      }

      if (counts.size > 0) {
        return Array.from(counts.entries())
          .map(([path, changeCount]) => ({ path, changeCount }))
          .sort((a, b) => b.changeCount - a.changeCount)
          .slice(0, limit);
      }
    } catch {
      // fall through to GitHub API
    }
  }

  const token = decrypt(repo.github_token_enc);
  const branch = await getCurrentBranch(repo);
  const res = await fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.name}/commits?per_page=30&sha=${encodeURIComponent(branch)}`,
    { headers: githubHeaders(token) }
  );
  if (!res.ok) return [];

  const commits = await res.json() as Array<{ sha: string }>;
  const counts = new Map<string, number>();

  for (const commit of commits.slice(0, 15)) {
    const detailRes = await fetch(
      `https://api.github.com/repos/${repo.owner}/${repo.name}/commits/${commit.sha}`,
      { headers: githubHeaders(token) }
    );
    if (!detailRes.ok) continue;
    const detail = await detailRes.json() as { files?: Array<{ filename: string }> };
    for (const file of detail.files || []) {
      if (file.filename.includes('node_modules')) continue;
      counts.set(file.filename, (counts.get(file.filename) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([path, changeCount]) => ({ path, changeCount }))
    .sort((a, b) => b.changeCount - a.changeCount)
    .slice(0, limit);
}

export interface RepoBranch {
  name: string;
  isDefault: boolean;
}

export async function listBranches(repo: Repository): Promise<RepoBranch[]> {
  const token = decrypt(repo.github_token_enc);
  const res = await fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.name}/branches?per_page=100`,
    { headers: githubHeaders(token) }
  );
  if (!res.ok) {
    throw new Error(`Failed to list branches (${res.status})`);
  }
  const data = await res.json() as Array<{ name: string }>;
  return data.map((b) => ({
    name: b.name,
    isDefault: b.name === repo.default_branch,
  }));
}

export async function getCurrentBranch(repo: Repository): Promise<string> {
  if (!repo.local_path || !(await pathExists(repo.local_path))) {
    return repo.default_branch;
  }
  try {
    const git = simpleGit(repo.local_path);
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    return branch.trim() || repo.default_branch;
  } catch {
    return repo.default_branch;
  }
}

export async function checkoutBranch(
  userId: string,
  repoId: string,
  branch: string
): Promise<{ branch: string; indexStatus: string }> {
  const repo = await getRepository(userId, repoId);
  if (!repo) throw new ApiError('REPO_NOT_FOUND', 'Repository not found', 404);
  if (repo.clone_status !== 'ready' || !repo.local_path) {
    throw new ApiError('REPO_NOT_READY', 'Repository is not ready');
  }

  const token = decrypt(repo.github_token_enc);
  const git = gitWithAuth(token, repo.local_path);

  const { logger } = await import('../utils/logger');
  logger.info('GIT', `Checking out branch "${branch}"`, `${repo.owner}/${repo.name}`);

  try {
    // Single-branch shallow clones only track the default branch; widen fetch refspec first.
    await git.remote(['set-branches', 'origin', '*']);
    await git.fetch(['origin', branch, '--depth', '50']);
    await git.checkout(['-B', branch, `origin/${branch}`]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('GIT', 'Branch checkout failed', message);
    throw new ApiError('INTERNAL_ERROR', message, 500);
  }

  try {
    await git.pull('origin', branch);
  } catch {
    // shallow pull may fail; checkout is enough
  }

  await updateIndexStatus(repo.id, 'indexing');
  indexRepository(repo)
    .then(() => logger.info('GIT', `Re-indexed after branch switch`, branch))
    .catch(async (err) => {
      const message = err instanceof Error ? err.message : String(err);
      await query(
        'UPDATE repositories SET index_status = $1, failure_reason = $2 WHERE id = $3',
        ['failed', message.slice(0, 500), repo.id]
      );
      logger.error('GIT', 'Re-index failed after branch switch', message);
    });

  return { branch, indexStatus: 'indexing' };
}
