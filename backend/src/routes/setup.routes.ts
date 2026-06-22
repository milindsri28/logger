import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getSetupStatus } from '../services/setup.service';
import { sendError } from '../utils/api-error';

const router = Router();
router.use(authMiddleware);

router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const status = await getSetupStatus(req.user!.userId);
    res.json(status);
  } catch (err) {
    sendError(res, err, 'Failed to get setup status');
  }
});

export default router;
