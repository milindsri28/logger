import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  analyzeRepository,
  getApis,
  getCommits,
  getDatabases,
  getEnvVars,
  getHotFiles,
  getIntegrations,
  getProjectInfo,
  getScanStatus,
  getServices,
  getStats,
} from '../services/repository-intelligence/repository-intelligence.service';
import { sendError } from '../utils/api-error';

const router = Router();
router.use(authMiddleware);

const analyzeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'RATE_LIMITED', message: 'Too many repository scans. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function repositoryIdFromQuery(req: AuthRequest): string {
  return String(req.query.repositoryId || '');
}

function branchFromQuery(req: AuthRequest): string | undefined {
  const branch = String(req.query.branch || '').trim();
  return branch || undefined;
}

const analyzeSchema = z.object({
  repositoryId: z.string().uuid(),
  branch: z.string().min(1).max(200).optional(),
});

router.post('/analyze', analyzeLimiter, validateBody(analyzeSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { repositoryId, branch } = req.body as z.infer<typeof analyzeSchema>;
    const { scan, result } = await analyzeRepository(req.user!.userId, repositoryId, branch);
    res.json({
      message: 'Repository scan completed',
      branch: result.branch,
      status: scan.status,
      scannedAt: scan.scanned_at,
      summary: {
        projectInfo: result.projectInfo,
        stats: result.stats,
        apiCount: result.apis.length,
        serviceCount: result.services.length,
        databaseCount: result.databases.length,
        integrationCount: result.integrations.length,
      },
    });
  } catch (err) {
    sendError(res, err, 'Repository analysis failed');
  }
});

router.get('/project-info', async (req: AuthRequest, res: Response) => {
  try {
    const repositoryId = repositoryIdFromQuery(req);
    if (!repositoryId) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'repositoryId is required' });
      return;
    }
    const data = await getProjectInfo(req.user!.userId, repositoryId, branchFromQuery(req));
    res.json(data);
  } catch (err) {
    sendError(res, err, 'Failed to get project info');
  }
});

router.get('/apis', async (req: AuthRequest, res: Response) => {
  try {
    const repositoryId = repositoryIdFromQuery(req);
    if (!repositoryId) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'repositoryId is required' });
      return;
    }
    const data = await getApis(req.user!.userId, repositoryId, branchFromQuery(req));
    res.json(data);
  } catch (err) {
    sendError(res, err, 'Failed to get API inventory');
  }
});

router.get('/services', async (req: AuthRequest, res: Response) => {
  try {
    const repositoryId = repositoryIdFromQuery(req);
    if (!repositoryId) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'repositoryId is required' });
      return;
    }
    const data = await getServices(req.user!.userId, repositoryId, branchFromQuery(req));
    res.json(data);
  } catch (err) {
    sendError(res, err, 'Failed to get services');
  }
});

router.get('/databases', async (req: AuthRequest, res: Response) => {
  try {
    const repositoryId = repositoryIdFromQuery(req);
    if (!repositoryId) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'repositoryId is required' });
      return;
    }
    const data = await getDatabases(req.user!.userId, repositoryId, branchFromQuery(req));
    res.json(data);
  } catch (err) {
    sendError(res, err, 'Failed to get databases');
  }
});

router.get('/env-vars', async (req: AuthRequest, res: Response) => {
  try {
    const repositoryId = repositoryIdFromQuery(req);
    if (!repositoryId) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'repositoryId is required' });
      return;
    }
    const data = await getEnvVars(req.user!.userId, repositoryId, branchFromQuery(req));
    res.json(data);
  } catch (err) {
    sendError(res, err, 'Failed to get environment variables');
  }
});

router.get('/integrations', async (req: AuthRequest, res: Response) => {
  try {
    const repositoryId = repositoryIdFromQuery(req);
    if (!repositoryId) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'repositoryId is required' });
      return;
    }
    const data = await getIntegrations(req.user!.userId, repositoryId, branchFromQuery(req));
    res.json(data);
  } catch (err) {
    sendError(res, err, 'Failed to get integrations');
  }
});

router.get('/commits', async (req: AuthRequest, res: Response) => {
  try {
    const repositoryId = repositoryIdFromQuery(req);
    if (!repositoryId) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'repositoryId is required' });
      return;
    }
    const data = await getCommits(req.user!.userId, repositoryId, branchFromQuery(req));
    res.json(data);
  } catch (err) {
    sendError(res, err, 'Failed to get commits');
  }
});

router.get('/hot-files', async (req: AuthRequest, res: Response) => {
  try {
    const repositoryId = repositoryIdFromQuery(req);
    if (!repositoryId) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'repositoryId is required' });
      return;
    }
    const data = await getHotFiles(req.user!.userId, repositoryId, branchFromQuery(req));
    res.json(data);
  } catch (err) {
    sendError(res, err, 'Failed to get hot files');
  }
});

router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const repositoryId = repositoryIdFromQuery(req);
    if (!repositoryId) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'repositoryId is required' });
      return;
    }
    const data = await getStats(req.user!.userId, repositoryId, branchFromQuery(req));
    res.json(data);
  } catch (err) {
    sendError(res, err, 'Failed to get repository stats');
  }
});

router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const repositoryId = repositoryIdFromQuery(req);
    if (!repositoryId) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'repositoryId is required' });
      return;
    }
    const data = await getScanStatus(req.user!.userId, repositoryId, branchFromQuery(req));
    res.json(data);
  } catch (err) {
    sendError(res, err, 'Failed to get scan status');
  }
});

export default router;
