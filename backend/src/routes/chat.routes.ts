import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { handleChatMessage } from '../services/chat.service';
import { sendError } from '../utils/api-error';

const router = Router();
router.use(authMiddleware);

const messageSchema = z.object({
  repositoryId: z.string().uuid(),
  agentId: z.string().uuid(),
  serviceName: z.string().min(1),
  selectedFile: z.string().optional(),
  message: z.string().min(1).max(4000),
  mode: z.enum(['question', 'analyze_logs', 'analyze_repository', 'correlate']).optional(),
});

router.post('/message', validateBody(messageSchema), async (req: AuthRequest, res: Response) => {
  try {
    const result = await handleChatMessage(req.user!.userId, req.body);
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Chat failed');
  }
});

export default router;
