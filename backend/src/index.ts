import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
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

import { pool } from './config/database';

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

app.use('/api/auth', authLimiter, authRoutes);
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

app.listen(config.port, async () => {
  logger.info('SERVER', `AI Debug Investigator API running on http://localhost:${config.port}`);
  logger.info('SERVER', `Frontend origin: ${config.frontendUrl}`);
  logger.info('SERVER', `Database: ${config.databaseUrl.replace(/:[^:@]+@/, ':***@')}`);

  try {
    await pool.query('SELECT 1');
    logger.info('SERVER', 'Database connected');
  } catch {
    logger.error(
      'SERVER',
      'Database connection failed — API requests will return 500. Start Docker, then run: docker compose up -d'
    );
  }
});
