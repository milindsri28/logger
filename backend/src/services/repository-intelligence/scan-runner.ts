import simpleGit from 'simple-git';
import { decrypt } from '../../utils/encryption';
import { getCurrentBranch, getRecentCommits, getRelevantFiles } from '../github.service';
import { Repository } from '../../types';
import { walkRepository } from './file-walker';
import { analyzeApiInventory } from './analyzers/api-inventory.analyzer';
import { analyzeDatabases } from './analyzers/database.analyzer';
import { analyzeEnvVars } from './analyzers/env-vars.analyzer';
import { analyzeIntegrations } from './analyzers/integrations.analyzer';
import { analyzeProjectInfo } from './analyzers/project-info.analyzer';
import { analyzeServices } from './analyzers/services.analyzer';
import type { CommitInfo, HotFile, ScanResult } from './types';

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function fetchCommitCount(repo: Repository, branch: string): Promise<number> {
  const token = decrypt(repo.github_token_enc);
  const res = await fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.name}/commits?per_page=1&sha=${encodeURIComponent(branch)}`,
    { headers: { ...githubHeaders(token), 'Content-Type': 'application/json' } }
  );
  if (!res.ok) return 0;

  const link = res.headers.get('link');
  if (link) {
    const lastMatch = link.match(/page=(\d+)>; rel="last"/);
    if (lastMatch) return parseInt(lastMatch[1], 10);
  }

  const data = await res.json() as unknown[];
  return Array.isArray(data) ? data.length : 0;
}

async function getHotFilesFromGit(localPath: string, limit: number): Promise<HotFile[]> {
  const git = simpleGit(localPath);
  const raw = await git.raw(['log', '--name-only', '--pretty=format:', '-100']);
  const counts = new Map<string, number>();

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.includes('node_modules') || trimmed.startsWith('.')) continue;
    counts.set(trimmed, (counts.get(trimmed) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([path, commitCount]) => ({ path, commitCount }))
    .sort((a, b) => b.commitCount - a.commitCount)
    .slice(0, limit);
}

export async function runRepositoryScan(repo: Repository, branch: string): Promise<ScanResult> {
  if (!repo.local_path) {
    throw new Error('Repository not cloned');
  }
  if (repo.clone_status !== 'ready') {
    throw new Error('Repository clone is not ready');
  }

  const currentBranch = await getCurrentBranch(repo);
  if (currentBranch !== branch) {
    throw new Error(`Local clone is on branch "${currentBranch}". Switch to "${branch}" before analyzing.`);
  }

  const { files, stats: walkStats } = await walkRepository(repo.local_path);

  const projectInfo = analyzeProjectInfo(files);
  const apis = analyzeApiInventory(files);
  const services = analyzeServices(files);
  const databases = analyzeDatabases(files);
  const envVars = analyzeEnvVars(files);
  const integrations = analyzeIntegrations(files);

  const recentCommitsRaw = await getRecentCommits(repo, 20);
  const commits: CommitInfo[] = recentCommitsRaw.map((c) => ({
    message: c.message,
    author: c.author,
    timestamp: c.date,
    hash: c.fullSha || c.sha,
  }));

  let hotFiles: HotFile[];
  try {
    hotFiles = await getHotFilesFromGit(repo.local_path, 20);
  } catch {
    const relevant = await getRelevantFiles(repo, 20);
    hotFiles = relevant.map((f) => ({ path: f.path, commitCount: f.changeCount }));
  }

  const totalCommits = await fetchCommitCount(repo, branch);

  return {
    branch,
    projectInfo,
    apis,
    services,
    databases,
    envVars,
    integrations,
    stats: {
      totalFiles: walkStats.totalFiles,
      totalFolders: walkStats.totalFolders,
      totalApis: apis.length,
      totalServices: services.length,
      totalCommits,
    },
    commits,
    hotFiles,
  };
}
