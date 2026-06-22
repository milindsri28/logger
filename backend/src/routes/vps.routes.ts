import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  createVpsConnection,
  getVpsConnections,
  getVpsConnection,
  deleteVpsConnection,
  testConnection,
  fetchLogs,
  formatLogs,
  listVpsServices,
  getServiceLogs,
  LogSource,
} from '../services/vps.service';

const router = Router();
router.use(authMiddleware);

const connectSchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(22),
  username: z.string().min(1),
  authType: z.enum(['key', 'password']),
  credential: z.string().min(1),
});

const fetchLogsSchema = z.object({
  vpsConnectionId: z.string().uuid(),
  sources: z.array(z.enum(['pm2', 'nginx', 'docker', 'node'])).min(1),
  lines: z.number().int().min(50).max(5000).optional(),
  serviceName: z.string().optional(),
  containerName: z.string().optional(),
});

const testSchema = z.object({
  vpsConnectionId: z.string().uuid(),
});

router.post('/connect', validateBody(connectSchema), async (req: AuthRequest, res: Response) => {
  try {
    const conn = await createVpsConnection(req.user!.userId, {
      name: req.body.name,
      host: req.body.host,
      port: req.body.port,
      username: req.body.username,
      authType: req.body.authType,
      credential: req.body.credential,
    });
    res.status(201).json({
      connection: {
        id: conn.id,
        name: conn.name,
        host: conn.host,
        port: conn.port,
        username: conn.username,
        authType: conn.auth_type,
        createdAt: conn.created_at,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create connection' });
  }
});

router.get('/connections', async (req: AuthRequest, res: Response) => {
  try {
    const connections = await getVpsConnections(req.user!.userId);
    res.json({
      connections: connections.map((c) => ({
        id: c.id,
        name: c.name,
        host: c.host,
        port: c.port,
        username: c.username,
        authType: c.auth_type,
        createdAt: c.created_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list connections' });
  }
});

router.delete('/connections/:id', async (req: AuthRequest, res: Response) => {
  try {
    await deleteVpsConnection(req.user!.userId, String(req.params.id));
    res.json({ message: 'Connection deleted' });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Delete failed' });
  }
});

router.post('/test', validateBody(testSchema), async (req: AuthRequest, res: Response) => {
  try {
    const conn = await getVpsConnection(req.user!.userId, req.body.vpsConnectionId);
    if (!conn) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }
    const result = await testConnection(conn);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Test failed' });
  }
});

router.post('/fetch-logs', validateBody(fetchLogsSchema), async (req: AuthRequest, res: Response) => {
  try {
    const conn = await getVpsConnection(req.user!.userId, req.body.vpsConnectionId);
    if (!conn) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }
    const logs = await fetchLogs(conn, {
      sources: req.body.sources as LogSource[],
      lines: req.body.lines,
      serviceName: req.body.serviceName,
      containerName: req.body.containerName,
    });
    res.json({
      logs,
      formatted: formatLogs(logs),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch logs' });
  }
});

router.get('/services', async (req: AuthRequest, res: Response) => {
  try {
    const vpsConnectionId = String(req.query.vpsConnectionId || '');
    if (!vpsConnectionId) {
      res.status(400).json({ error: 'vpsConnectionId is required' });
      return;
    }
    const services = await listVpsServices(req.user!.userId, vpsConnectionId);
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list services' });
  }
});

router.get('/logs', async (req: AuthRequest, res: Response) => {
  try {
    const vpsConnectionId = String(req.query.vpsConnectionId || '');
    const service = String(req.query.service || '');
    const lines = parseInt(String(req.query.lines || '300'), 10);
    if (!vpsConnectionId || !service) {
      res.status(400).json({ error: 'vpsConnectionId and service are required' });
      return;
    }
    const logs = await getServiceLogs(req.user!.userId, vpsConnectionId, service, lines);
    res.json({ service, logs, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch logs' });
  }
});

export default router;
