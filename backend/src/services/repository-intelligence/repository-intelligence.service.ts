import { query, queryOne } from '../../config/database';
import { ApiError } from '../../utils/api-error';
import { getCurrentBranch, getRepository } from '../github.service';
import { runRepositoryScan } from './scan-runner';
import type {
  ApiEndpoint,
  CommitInfo,
  HotFile,
  ProjectInfo,
  RepositoryScanRow,
  RepositoryStats,
  ScanResult,
} from './types';

export async function resolveScanBranch(
  userId: string,
  repositoryId: string,
  branch?: string
): Promise<{ repo: NonNullable<Awaited<ReturnType<typeof getRepository>>>; branch: string }> {
  const repo = await getRepository(userId, repositoryId);
  if (!repo) throw new ApiError('REPO_NOT_FOUND', 'Repository not found', 404);
  if (repo.clone_status !== 'ready') {
    throw new ApiError('REPO_NOT_READY', 'Repository is not ready for analysis', 400);
  }

  const resolvedBranch = branch?.trim() || (await getCurrentBranch(repo));
  return { repo, branch: resolvedBranch };
}

export async function getScanForBranch(
  repositoryId: string,
  branch: string
): Promise<RepositoryScanRow | null> {
  return queryOne<RepositoryScanRow>(
    'SELECT * FROM repository_scans WHERE repository_id = $1 AND branch = $2',
    [repositoryId, branch]
  );
}

async function clearScanChildren(scanId: string): Promise<void> {
  await Promise.all([
    query('DELETE FROM repository_apis WHERE scan_id = $1', [scanId]),
    query('DELETE FROM repository_services WHERE scan_id = $1', [scanId]),
    query('DELETE FROM repository_detected_integrations WHERE scan_id = $1', [scanId]),
    query('DELETE FROM repository_hot_files WHERE scan_id = $1', [scanId]),
  ]);
}

async function persistScanResult(repositoryId: string, result: ScanResult): Promise<RepositoryScanRow> {
  const existing = await getScanForBranch(repositoryId, result.branch);

  let scan: RepositoryScanRow;

  if (existing) {
    await clearScanChildren(existing.id);
    scan = (await queryOne<RepositoryScanRow>(
      `UPDATE repository_scans SET
        status = 'completed',
        project_info = $1,
        databases = $2,
        env_vars = $3,
        stats = $4,
        recent_commits = $5,
        error_message = NULL,
        scanned_at = NOW(),
        updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        JSON.stringify(result.projectInfo),
        JSON.stringify(result.databases),
        JSON.stringify(result.envVars),
        JSON.stringify(result.stats),
        JSON.stringify(result.commits),
        existing.id,
      ]
    ))!;
  } else {
    scan = (await queryOne<RepositoryScanRow>(
      `INSERT INTO repository_scans
        (repository_id, branch, status, project_info, databases, env_vars, stats, recent_commits, scanned_at)
       VALUES ($1, $2, 'completed', $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [
        repositoryId,
        result.branch,
        JSON.stringify(result.projectInfo),
        JSON.stringify(result.databases),
        JSON.stringify(result.envVars),
        JSON.stringify(result.stats),
        JSON.stringify(result.commits),
      ]
    ))!;
  }

  if (!scan) throw new Error('Failed to persist scan');

  await Promise.all([
    ...result.apis.map((api) =>
      query(
        'INSERT INTO repository_apis (scan_id, method, path, file_path) VALUES ($1, $2, $3, $4)',
        [scan.id, api.method, api.path, api.file]
      )
    ),
    ...result.services.map((name) =>
      query('INSERT INTO repository_services (scan_id, name) VALUES ($1, $2)', [scan.id, name])
    ),
    ...result.integrations.map((name) =>
      query('INSERT INTO repository_detected_integrations (scan_id, name) VALUES ($1, $2)', [scan.id, name])
    ),
    ...result.hotFiles.map((hf) =>
      query(
        'INSERT INTO repository_hot_files (scan_id, file_path, commit_count) VALUES ($1, $2, $3)',
        [scan.id, hf.path, hf.commitCount]
      )
    ),
  ]);

  return scan;
}

export async function analyzeRepository(
  userId: string,
  repositoryId: string,
  branch?: string
): Promise<{ scan: RepositoryScanRow; result: ScanResult }> {
  const { repo, branch: resolvedBranch } = await resolveScanBranch(userId, repositoryId, branch);

  const existing = await getScanForBranch(repositoryId, resolvedBranch);
  if (existing) {
    await query(
      `UPDATE repository_scans SET status = 'running', error_message = NULL, updated_at = NOW() WHERE id = $1`,
      [existing.id]
    );
  } else {
    await query(
      `INSERT INTO repository_scans (repository_id, branch, status) VALUES ($1, $2, 'running')
       ON CONFLICT (repository_id, branch) DO UPDATE SET status = 'running', error_message = NULL, updated_at = NOW()`,
      [repositoryId, resolvedBranch]
    );
  }

  try {
    const result = await runRepositoryScan(repo, resolvedBranch);
    const scan = await persistScanResult(repositoryId, result);
    return { scan, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await query(
      `UPDATE repository_scans SET status = 'failed', error_message = $1, updated_at = NOW()
       WHERE repository_id = $2 AND branch = $3`,
      [message.slice(0, 500), repositoryId, resolvedBranch]
    );
    throw err;
  }
}

async function requireCompletedScan(
  userId: string,
  repositoryId: string,
  branch?: string
): Promise<{ scan: RepositoryScanRow; branch: string }> {
  const { branch: resolvedBranch } = await resolveScanBranch(userId, repositoryId, branch);
  const scan = await getScanForBranch(repositoryId, resolvedBranch);

  if (!scan || scan.status !== 'completed') {
    throw new ApiError(
      'SCAN_NOT_FOUND',
      'No completed scan for this branch. Run analyze first.',
      404
    );
  }

  return { scan, branch: resolvedBranch };
}

export async function getProjectInfo(
  userId: string,
  repositoryId: string,
  branch?: string
): Promise<{ branch: string; projectInfo: ProjectInfo; scannedAt: string | null }> {
  const { scan, branch: resolvedBranch } = await requireCompletedScan(userId, repositoryId, branch);
  return {
    branch: resolvedBranch,
    projectInfo: scan.project_info as ProjectInfo,
    scannedAt: scan.scanned_at?.toISOString() ?? null,
  };
}

export async function getApis(
  userId: string,
  repositoryId: string,
  branch?: string
): Promise<{ branch: string; apis: ApiEndpoint[] }> {
  const { scan, branch: resolvedBranch } = await requireCompletedScan(userId, repositoryId, branch);
  const rows = await query<{ method: string; path: string; file_path: string }>(
    'SELECT method, path, file_path FROM repository_apis WHERE scan_id = $1 ORDER BY path, method',
    [scan.id]
  );
  return {
    branch: resolvedBranch,
    apis: rows.map((r) => ({ method: r.method, path: r.path, file: r.file_path })),
  };
}

export async function getServices(
  userId: string,
  repositoryId: string,
  branch?: string
): Promise<{ branch: string; services: string[] }> {
  const { scan, branch: resolvedBranch } = await requireCompletedScan(userId, repositoryId, branch);
  const rows = await query<{ name: string }>(
    'SELECT name FROM repository_services WHERE scan_id = $1 ORDER BY name',
    [scan.id]
  );
  return { branch: resolvedBranch, services: rows.map((r) => r.name) };
}

export async function getDatabases(
  userId: string,
  repositoryId: string,
  branch?: string
): Promise<{ branch: string; databases: string[] }> {
  const { scan, branch: resolvedBranch } = await requireCompletedScan(userId, repositoryId, branch);
  return { branch: resolvedBranch, databases: scan.databases as string[] };
}

export async function getEnvVars(
  userId: string,
  repositoryId: string,
  branch?: string
): Promise<{ branch: string; envVars: string[] }> {
  const { scan, branch: resolvedBranch } = await requireCompletedScan(userId, repositoryId, branch);
  return { branch: resolvedBranch, envVars: scan.env_vars as string[] };
}

export async function getIntegrations(
  userId: string,
  repositoryId: string,
  branch?: string
): Promise<{ branch: string; integrations: string[] }> {
  const { scan, branch: resolvedBranch } = await requireCompletedScan(userId, repositoryId, branch);
  const rows = await query<{ name: string }>(
    'SELECT name FROM repository_detected_integrations WHERE scan_id = $1 ORDER BY name',
    [scan.id]
  );
  return { branch: resolvedBranch, integrations: rows.map((r) => r.name) };
}

export async function getCommits(
  userId: string,
  repositoryId: string,
  branch?: string
): Promise<{ branch: string; commits: CommitInfo[] }> {
  const { scan, branch: resolvedBranch } = await requireCompletedScan(userId, repositoryId, branch);
  return { branch: resolvedBranch, commits: scan.recent_commits as CommitInfo[] };
}

export async function getHotFiles(
  userId: string,
  repositoryId: string,
  branch?: string
): Promise<{ branch: string; hotFiles: HotFile[] }> {
  const { scan, branch: resolvedBranch } = await requireCompletedScan(userId, repositoryId, branch);
  const rows = await query<{ file_path: string; commit_count: number }>(
    'SELECT file_path, commit_count FROM repository_hot_files WHERE scan_id = $1 ORDER BY commit_count DESC',
    [scan.id]
  );
  return {
    branch: resolvedBranch,
    hotFiles: rows.map((r) => ({ path: r.file_path, commitCount: r.commit_count })),
  };
}

export async function getStats(
  userId: string,
  repositoryId: string,
  branch?: string
): Promise<{ branch: string; stats: RepositoryStats; scannedAt: string | null }> {
  const { scan, branch: resolvedBranch } = await requireCompletedScan(userId, repositoryId, branch);
  return {
    branch: resolvedBranch,
    stats: scan.stats as RepositoryStats,
    scannedAt: scan.scanned_at?.toISOString() ?? null,
  };
}

export async function getScanStatus(
  userId: string,
  repositoryId: string,
  branch?: string
): Promise<{ branch: string; status: string; scannedAt: string | null; errorMessage: string | null }> {
  const { branch: resolvedBranch } = await resolveScanBranch(userId, repositoryId, branch);
  const scan = await getScanForBranch(repositoryId, resolvedBranch);

  return {
    branch: resolvedBranch,
    status: scan?.status ?? 'none',
    scannedAt: scan?.scanned_at?.toISOString() ?? null,
    errorMessage: scan?.error_message ?? null,
  };
}
