import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getIntegrationsStatus } from '../services/integrations.service';
import { disconnectGitHub } from '../services/oauth/oauth.service';
import { sendError } from '../utils/api-error';

const router = Router();
router.use(authMiddleware);

router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const status = await getIntegrationsStatus(req.user!.userId);
    res.json(status);
  } catch (err) {
    sendError(res, err, 'Failed to get integrations status');
  }
});

router.delete('/repositories/github', async (req: AuthRequest, res: Response) => {
  try {
    await disconnectGitHub(req.user!.userId);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err, 'Failed to disconnect GitHub');
  }
});

export default router;
