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

router.delete('/repositories/:id', async (req: AuthRequest, res: Response) => {
  try {
    await deleteRepository(req.user!.userId, String(req.params.id));
    res.json({ message: 'Repository deleted' });
  } catch (err) {
    sendError(res, err, 'Delete failed');
  }
});

export default router;
