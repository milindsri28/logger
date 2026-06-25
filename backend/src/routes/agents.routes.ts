import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createAgentToken } from '../services/agents/agent-token.service';
import { listAgentsForUser, getAgentForUser, deleteAgentForUser } from '../services/agents/agent.service';
import { dispatchAgentJob, startFollowJob, getAgentConnection } from '../services/agents/agent-gateway.service';
import { getAgentDockerServices, isAgentWsConnected, resolveAgentServiceType } from '../services/agents/agent-docker.service';
import { fetchAgentServiceLogs } from '../services/agents/agent-logs.service';
import { validateAgentCommand } from '../services/agents/command-whitelist';
import { sendError } from '../utils/api-error';

const router = Router();
router.use(authMiddleware);

function parseServiceQuery(req: AuthRequest): {
  serviceName: string;
  serviceType?: 'docker' | 'pm2' | 'system';
} {
  const serviceName = String(req.query.service || req.query.container || '');
  const rawType = String(req.query.type || '');
  const serviceType =
    rawType === 'pm2' || rawType === 'docker' || rawType === 'system'
      ? (rawType as 'docker' | 'pm2' | 'system')
      : undefined;
  return { serviceName, serviceType };
}

const tokenSchema = z.object({
  label: z.string().min(1).max(255).optional(),
});

const commandSchema = z.object({
  command: z.string().min(1),
  args: z.record(z.unknown()).optional().default({}),
});

router.post('/tokens', validateBody(tokenSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { token, plainToken, installCommand } = await createAgentToken(
      req.user!.userId,
      req.body.label || 'server'
    );
    res.status(201).json({
      tokenId: token.id,
      token: plainToken,
      installCommand,
      expiresAt: token.expires_at,
    });
  } catch (err) {
    sendError(res, err, 'Failed to create agent token');
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const agents = await listAgentsForUser(req.user!.userId);
    res.json({
      agents: agents.map((a) => ({
        id: a.id,
        hostname: a.hostname,
        os: a.os,
        status: a.status,
        lastSeenAt: a.last_seen_at,
        createdAt: a.created_at,
        wsConnected: isAgentWsConnected(a.id),
      })),
    });
  } catch (err) {
    sendError(res, err, 'Failed to list agents');
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const agentId = String(req.params.id);
    const ws = getAgentConnection(agentId);
    if (ws) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
    await deleteAgentForUser(req.user!.userId, agentId);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err, 'Failed to delete agent');
  }
});

router.get('/:id/services', async (req: AuthRequest, res: Response) => {
  try {
    const agent = await getAgentForUser(req.user!.userId, String(req.params.id));
    if (!agent) {
      res.status(404).json({ error: 'AGENT_NOT_FOUND', message: 'Agent not found' });
      return;
    }

    const result = await getAgentDockerServices(agent.id);
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Failed to load agent services');
  }
});

router.get('/:id/logs', async (req: AuthRequest, res: Response) => {
  try {
    const agent = await getAgentForUser(req.user!.userId, String(req.params.id));
    if (!agent) {
      res.status(404).json({ error: 'AGENT_NOT_FOUND', message: 'Agent not found' });
      return;
    }

    const { serviceName, serviceType } = parseServiceQuery(req);
    const lines = Math.min(5000, Math.max(50, parseInt(String(req.query.lines || '500'), 10) || 500));
    if (!serviceName) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'service or container is required' });
      return;
    }

    const logs = await fetchAgentServiceLogs(agent.id, serviceName, lines, serviceType);
    res.json({ logs, fetchedAt: new Date().toISOString() });
  } catch (err) {
    sendError(res, err, 'Failed to fetch agent logs');
  }
});

router.get('/:id/logs/download', async (req: AuthRequest, res: Response) => {
  try {
    const agent = await getAgentForUser(req.user!.userId, String(req.params.id));
    if (!agent) {
      res.status(404).json({ error: 'AGENT_NOT_FOUND', message: 'Agent not found' });
      return;
    }

    const { serviceName, serviceType } = parseServiceQuery(req);
    const lines = Math.min(5000, Math.max(50, parseInt(String(req.query.lines || '500'), 10) || 500));
    if (!serviceName) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'service or container is required' });
      return;
    }

    const logs = await fetchAgentServiceLogs(agent.id, serviceName, lines, serviceType);
    const filename = `${serviceName}-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(logs);
  } catch (err) {
    sendError(res, err, 'Failed to download agent logs');
  }
});

router.get('/:id/logs/stream', async (req: AuthRequest, res: Response) => {
  let followHandle: ReturnType<typeof startFollowJob> | null = null;

  const cleanup = () => {
    if (followHandle) {
      followHandle.cancel();
      followHandle = null;
    }
  };

  req.on('close', cleanup);

  try {
    const agent = await getAgentForUser(req.user!.userId, String(req.params.id));
    if (!agent) {
      res.status(404).json({ error: 'AGENT_NOT_FOUND', message: 'Agent not found' });
      return;
    }

    const { serviceName, serviceType: queryType } = parseServiceQuery(req);
    const tail = Math.min(1000, Math.max(1, parseInt(String(req.query.tail || '200'), 10) || 200));
    if (!serviceName) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'service or container is required' });
      return;
    }

    if (!isAgentWsConnected(agent.id)) {
      res.status(503).json({ error: 'AGENT_WS_OFFLINE', message: 'Agent live channel is offline' });
      return;
    }

    const serviceType = queryType ?? (await resolveAgentServiceType(agent.id, serviceName));

    if (serviceType === 'system') {
      res.status(400).json({
        error: 'STREAM_NOT_SUPPORTED',
        message: 'Live streaming is not available for system services. Use refresh mode.',
      });
      return;
    }

    if (serviceType === 'pm2') {
      validateAgentCommand('pm2_logs', { appName: serviceName, tail, follow: true }, { allowFollow: true });
    } else {
      validateAgentCommand('docker_logs', { containerId: serviceName, tail, follow: true }, { allowFollow: true });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    followHandle =
      serviceType === 'pm2'
        ? startFollowJob(agent.id, {
            command: 'pm2_logs',
            args: { appName: serviceName, tail, follow: true },
          })
        : startFollowJob(agent.id, {
            command: 'docker_logs',
            args: { containerId: serviceName, tail, follow: true },
          });

    const unsubscribe = followHandle.subscribe((chunk) => {
      res.write(`data: ${JSON.stringify({ stream: chunk.stream, line: chunk.data })}\n\n`);
    });

    followHandle.completed
      .then(() => {
        unsubscribe();
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      })
      .catch((err) => {
        unsubscribe();
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        }
      });
  } catch (err) {
    cleanup();
    if (!res.headersSent) {
      sendError(res, err, 'Failed to start log stream');
    } else if (!res.writableEnded) {
      res.end();
    }
  }
});

router.post('/:id/commands', validateBody(commandSchema), async (req: AuthRequest, res: Response) => {
  try {
    const agent = await getAgentForUser(req.user!.userId, String(req.params.id));
    if (!agent) {
      res.status(404).json({ error: 'AGENT_NOT_FOUND', message: 'Agent not found' });
      return;
    }

    const args = req.body.args || {};
    const command = validateAgentCommand(req.body.command, args);

    const result = await dispatchAgentJob(agent.id, { command, args });
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Command dispatch failed');
  }
});

export default router;
