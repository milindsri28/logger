import http from 'http';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from './config';
import { requestLogger } from './middleware/request-logger';
import { logger } from './utils/logger';
import authRoutes from './routes/auth.routes';
import githubRoutes from './routes/github.routes';
import vpsRoutes from './routes/vps.routes';
import incidentRoutes from './routes/incident.routes';
import repoRoutes from './routes/repo.routes';
import setupRoutes from './routes/setup.routes';
import chatRoutes from './routes/chat.routes';
import repositoryRoutes from './routes/repository.routes';
import oauthRoutes from './routes/oauth.routes';
import integrationsRoutes from './routes/integrations.routes';
import agentsRoutes from './routes/agents.routes';
import agentGatewayRoutes from './routes/agent-gateway.routes';
import { verifyAgentToken } from './services/agents/agent-jwt.service';
import { ensureAgentExists } from './services/agents/agent.service';
import {
  registerAgentConnection,
  unregisterAgentConnection,
  handleAgentWsMessage,
  startAgentStaleChecker,
} from './services/agents/agent-gateway.service';

import { pool } from './config/database';
import { runMigrations } from './config/migrate';

const app = express();

app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(requestLogger);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const chatLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30 });

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database unreachable';
    res.status(503).json({
      status: 'degraded',
      database: 'disconnected',
      message:
        message ||
        'PostgreSQL is not reachable. Start Docker and run: docker compose up -d',
      timestamp: new Date().toISOString(),
    });
  }
});

function resolveInstallScriptPath(): string {
  const candidates = [
    path.resolve(__dirname, '../../agent/scripts/install.sh'),
    path.resolve(__dirname, '../../../agent/scripts/install.sh'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

app.get('/agent/install.sh', (_req, res) => {
  const scriptPath = resolveInstallScriptPath();
  if (!fs.existsSync(scriptPath)) {
    res.status(404).send('# install script not found');
    return;
  }
  const script = fs.readFileSync(scriptPath, 'utf8').replace(/\r\n/g, '\n');
  res.type('text/plain').send(script);
});

app.get('/agent/releases/argusops-agent', (_req, res) => {
  const candidates = [
    path.resolve(__dirname, '../../agent/dist/argusops-agent'),
    path.resolve(__dirname, '../../../agent/dist/argusops-agent'),
  ];
  const binary = candidates.find((p) => fs.existsSync(p));
  if (!binary) {
    res.status(404).json({ error: 'Agent binary not built. Run: make -C agent build' });
    return;
  }
  res.sendFile(binary);
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/agent', agentGatewayRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/vps', vpsRoutes);
app.use('/api/repo', repoRoutes);
app.use('/api/chat', chatLimiter, chatRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/repository', repositoryRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('SERVER', 'Unhandled error', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '', `http://${request.headers.host}`);
  if (url.pathname !== '/agent/ws') {
    socket.destroy();
    return;
  }

  const authHeader = request.headers.authorization;
  const tokenFromQuery = url.searchParams.get('token');
  const rawToken =
    authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : tokenFromQuery || '';

  if (!rawToken) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  let agentId: string;
  try {
    agentId = verifyAgentToken(rawToken).agentId;
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  void ensureAgentExists(agentId)
    .then(() => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        registerAgentConnection(agentId, ws);
        ws.send(JSON.stringify({ type: 'ack', payload: { connected: true } }));

        ws.on('message', (data) => {
          handleAgentWsMessage(agentId, data.toString());
        });

        ws.on('close', () => {
          unregisterAgentConnection(agentId, ws);
        });

        ws.on('error', () => {
          unregisterAgentConnection(agentId, ws);
        });
      });
    })
    .catch(() => {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    });
});

server.listen(config.port, async () => {
  startAgentStaleChecker();
  logger.info('SERVER', `API running at ${config.backendUrl}`);
  logger.info('SERVER', `WebSocket at ${config.wsUrl}`);
  logger.info('SERVER', `Frontend origin: ${config.frontendUrl}`);

  try {
    await pool.query('SELECT 1');
    await runMigrations(pool);
    logger.info('SERVER', 'Database connected');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      'SERVER',
      'Database connection or migration failed — API requests may return 500.',
      message
    );
  }
});

// Keepalive pings
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping', ts: new Date().toISOString() }));
    }
  });
}, 15_000);
