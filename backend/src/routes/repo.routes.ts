import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getRepoTree, getRepoFile, searchRepoFiles } from '../services/repo.service';

const router = Router();
router.use(authMiddleware);

router.get('/tree', async (req: AuthRequest, res: Response) => {
  try {
    const repositoryId = String(req.query.repositoryId || '');
    if (!repositoryId) {
      res.status(400).json({ error: 'repositoryId is required' });
      return;
    }
    const tree = await getRepoTree(req.user!.userId, repositoryId);
    res.json(tree);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to load tree' });
  }
});

router.get('/file', async (req: AuthRequest, res: Response) => {
  try {
    const repositoryId = String(req.query.repositoryId || '');
    const filePath = String(req.query.path || '');
    if (!repositoryId || !filePath) {
      res.status(400).json({ error: 'repositoryId and path are required' });
      return;
    }
    const file = await getRepoFile(req.user!.userId, repositoryId, filePath);
    res.json(file);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to load file' });
  }
});

router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const repositoryId = String(req.query.repositoryId || '');
    const q = String(req.query.q || '');
    if (!repositoryId || !q) {
      res.status(400).json({ error: 'repositoryId and q are required' });
      return;
    }
    const results = await searchRepoFiles(req.user!.userId, repositoryId, q);
    res.json({ results });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Search failed' });
  }
});

export default router;
