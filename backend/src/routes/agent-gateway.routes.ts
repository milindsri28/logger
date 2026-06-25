import { Router, Response } from 'express';
import { z } from 'zod';
import { AgentRequest, agentAuthMiddleware } from '../middleware/agent-auth';
import { validateBody } from '../middleware/validate';
import { registerAgent, recordHeartbeat } from '../services/agents/agent-gateway.service';
import { sendError } from '../utils/api-error';

const router = Router();

const registerSchema = z.object({
  token: z.string().min(1),
  hostname: z.string().min(1).max(255),
  os: z.string().max(100).optional(),
});

const heartbeatSchema = z.object({
  cpu: z.number().optional(),
  memory: z
    .object({
      usedMb: z.number().optional(),
      totalMb: z.number().optional(),
    })
    .optional(),
  disk: z.object({ usedPct: z.number().optional() }).optional(),
  load: z.object({ '1': z.number().optional() }).optional(),
  dockerContainers: z.array(z.unknown()).optional(),
  pm2Processes: z.array(z.unknown()).optional(),
  systemServices: z.array(z.unknown()).optional(),
});

router.post('/register', validateBody(registerSchema), async (req, res: Response) => {
  try {
    const result = await registerAgent(req.body.token, req.body.hostname, req.body.os);
    res.status(201).json(result);
  } catch (err) {
    sendError(res, err, 'Agent registration failed');
  }
});

router.post(
  '/heartbeat',
  agentAuthMiddleware,
  validateBody(heartbeatSchema),
  async (req: AgentRequest, res: Response) => {
    try {
      await recordHeartbeat(req.agent!.agentId, req.body);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err, 'Heartbeat failed');
    }
  }
);

export default router;
