import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  addRepository,
  getRepositories,
  getRepository,
  deleteRepository,
  syncRepository,
  connectGitHub,
  getRecentCommits,
  getRelevantFiles,
  listBranches,
  getCurrentBranch,
  checkoutBranch,
  listAvailableGitHubRepos,
  connectRepositories,
} from '../services/github.service';
import { sendError } from '../utils/api-error';

const router = Router();
router.use(authMiddleware);

const connectSchema = z.object({
  githubToken: z.string().min(1),
});

const repositorySchema = z.object({
  repoUrl: z.string().url(),
  githubToken: z.string().min(1).optional(),
});

const connectReposSchema = z.object({
  repoUrls: z.array(z.string().url()).min(1).max(20),
});

router.post('/connect', validateBody(connectSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = await connectGitHub(req.user!.userId, req.body.githubToken);
    res.json({ success: true, githubUser: user.login });
  } catch (err) {
    sendError(res, err, 'Invalid token');
  }
});

router.post('/repository', validateBody(repositorySchema), async (req: AuthRequest, res: Response) => {
  try {
    const repo = await addRepository(req.user!.userId, req.body.repoUrl, req.body.githubToken);
    res.status(201).json({
      repository: {
        id: repo.id,
        repoUrl: repo.repo_url,
        owner: repo.owner,
        name: repo.name,
        cloneStatus: repo.clone_status,
        indexStatus: repo.index_status,
        failureReason: repo.failure_reason ?? null,
      },
    });
  } catch (err) {
    sendError(res, err, 'Failed to add repository');
  }
});

router.get('/available-repositories', async (req: AuthRequest, res: Response) => {
  try {
    const repositories = await listAvailableGitHubRepos(req.user!.userId);
    res.json({ repositories });
  } catch (err) {
    sendError(res, err, 'Failed to list available repositories');
  }
});

router.post('/repositories/connect', validateBody(connectReposSchema), async (req: AuthRequest, res: Response) => {
  try {
    const result = await connectRepositories(req.user!.userId, req.body.repoUrls);
    res.status(201).json(result);
  } catch (err) {
    sendError(res, err, 'Failed to connect repositories');
  }
});

router.get('/repositories', async (req: AuthRequest, res: Response) => {
  try {
    const repos = await getRepositories(req.user!.userId);
    res.json({
      repositories: repos.map((r) => ({
        id: r.id,
        repoUrl: r.repo_url,
        owner: r.owner,
        name: r.name,
        defaultBranch: r.default_branch,
        cloneStatus: r.clone_status,
        indexStatus: r.index_status,
        failureReason: r.failure_reason ?? null,
        fileCount: r.file_count,
        lastSyncedAt: r.last_synced_at,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    sendError(res, err, 'Failed to list repositories');
  }
});

router.get('/repositories/:id', async (req: AuthRequest, res: Response) => {
  try {
    const repo = await getRepository(req.user!.userId, String(req.params.id));
    if (!repo) {
      res.status(404).json({ error: 'REPO_NOT_FOUND', message: 'Repository not found' });
      return;
    }
    res.json({
      repository: {
        id: repo.id,
        repoUrl: repo.repo_url,
        owner: repo.owner,
        name: repo.name,
        defaultBranch: repo.default_branch,
        cloneStatus: repo.clone_status,
        indexStatus: repo.index_status,
        failureReason: repo.failure_reason ?? null,
        fileCount: repo.file_count,
        lastSyncedAt: repo.last_synced_at,
      },
    });
  } catch (err) {
    sendError(res, err, 'Failed to get repository');
  }
});

router.post('/repositories/:id/sync', async (req: AuthRequest, res: Response) => {
  try {
    const repo = await syncRepository(req.user!.userId, String(req.params.id));
    res.json({ message: 'Sync started', repository: { id: repo.id, cloneStatus: repo.clone_status } });
  } catch (err) {
    sendError(res, err, 'Sync failed');
  }
});

const checkoutSchema = z.object({
  branch: z.string().min(1).max(200),
});

router.get('/repositories/:id/branches', async (req: AuthRequest, res: Response) => {
  try {
    const repo = await getRepository(req.user!.userId, String(req.params.id));
    if (!repo) {
      res.status(404).json({ error: 'REPO_NOT_FOUND', message: 'Repository not found' });
      return;
    }
    const [branches, currentBranch] = await Promise.all([
      listBranches(repo),
      getCurrentBranch(repo),
    ]);
    res.json({ branches, currentBranch, defaultBranch: repo.default_branch });
  } catch (err) {
    sendError(res, err, 'Failed to list branches');
  }
});

router.post('/repositories/:id/checkout', validateBody(checkoutSchema), async (req: AuthRequest, res: Response) => {
  try {
    const result = await checkoutBranch(req.user!.userId, String(req.params.id), req.body.branch);
    res.json({ message: 'Branch switched', ...result });
  } catch (err) {
    sendError(res, err, 'Failed to switch branch');
  }
});

router.get('/repositories/:id/commits', async (req: AuthRequest, res: Response) => {
  try {
    const repo = await getRepository(req.user!.userId, String(req.params.id));
    if (!repo) {
      res.status(404).json({ error: 'REPO_NOT_FOUND', message: 'Repository not found' });
      return;
    }
    const limit = Math.min(parseInt(String(req.query.limit || '20'), 10), 50);
    const commits = await getRecentCommits(repo, limit);
    res.json({
      commits: commits.map((c) => ({
        sha: c.sha,
        fullSha: c.fullSha,
        message: c.message,
        author: c.author,
        date: c.date,
        url: c.url || `https://github.com/${repo.owner}/${repo.name}/commit/${c.fullSha || c.sha}`,
      })),
      repository: { owner: repo.owner, name: repo.name },
    });
  } catch (err) {
    sendError(res, err, 'Failed to fetch commits');
  }
});

router.get('/repositories/:id/relevant-files', async (req: AuthRequest, res: Response) => {
  try {
    const repo = await getRepository(req.user!.userId, String(req.params.id));
    if (!repo) {
      res.status(404).json({ error: 'REPO_NOT_FOUND', message: 'Repository not found' });
      return;
    }
    const limit = Math.min(parseInt(String(req.query.limit || '15'), 10), 50);
    const files = await getRelevantFiles(repo, limit);
    res.json({ files });
  } catch (err) {
    sendError(res, err, 'Failed to fetch relevant files');
  }
});

router.delete('/repositories/:id', async (req: AuthRequest, res: Response) => {
  try {
    await deleteRepository(req.user!.userId, String(req.params.id));
    res.json({ message: 'Repository deleted' });
  } catch (err) {
    sendError(res, err, 'Delete failed');
  }
});

export default router;
