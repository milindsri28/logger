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

const app = express();

app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(requestLogger);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const analyzeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10 });
const chatLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30 });

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/vps', vpsRoutes);
app.use('/api/repo', repoRoutes);
app.use('/api/chat', chatLimiter, chatRoutes);
app.use('/api/incidents', analyzeLimiter, incidentRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('SERVER', 'Unhandled error', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  logger.info('SERVER', `AI Debug Investigator API running on http://localhost:${config.port}`);
  logger.info('SERVER', `Frontend origin: ${config.frontendUrl}`);
  logger.info('SERVER', `Database: ${config.databaseUrl.replace(/:[^:@]+@/, ':***@')}`);
});
