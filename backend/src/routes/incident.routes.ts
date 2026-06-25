import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  createAndAnalyzeIncident,
  getIncidents,
  getIncident,
  getAnalysisReport,
  getLatestIncidentForService,
} from '../services/incident.service';
import { sendError } from '../utils/api-error';

const router = Router();
router.use(authMiddleware);

const analyzeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many investigations. Try again in an hour.' },
});

const analyzeSchema = z.object({
  repositoryId: z.string().uuid(),
  agentId: z.string().uuid(),
  serviceName: z.string().min(1),
  selectedFile: z.string().optional(),
  title: z.string().optional(),
  lines: z.number().int().min(50).max(5000).optional(),
});

router.post('/analyze', analyzeLimiter, validateBody(analyzeSchema), async (req: AuthRequest, res: Response) => {
  try {
    const incident = await createAndAnalyzeIncident(req.user!.userId, req.body);
    res.status(202).json({
      incident: {
        id: incident.id,
        title: incident.title,
        status: incident.status,
        progressStep: incident.progress_step,
        serviceName: incident.service_name,
        createdAt: incident.created_at,
      },
    });
  } catch (err) {
    sendError(res, err, 'Analysis failed to start');
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const incidents = await getIncidents(req.user!.userId);
    res.json({
      incidents: incidents.map((i) => ({
        id: i.id,
        title: i.title,
        status: i.status,
        serviceName: i.service_name,
        logSources: i.log_sources,
        createdAt: i.created_at,
        completedAt: i.completed_at,
      })),
    });
  } catch (err) {
    sendError(res, err, 'Failed to list incidents');
  }
});

router.get('/latest', async (req: AuthRequest, res: Response) => {
  try {
    const serviceName = String(req.query.serviceName || '');
    if (!serviceName) {
      res.status(400).json({ error: 'serviceName is required' });
      return;
    }
    const result = await getLatestIncidentForService(req.user!.userId, serviceName);
    if (!result) {
      res.json({ incident: null, report: null });
      return;
    }
    const { incident, report } = result;
    res.json({
      incident: {
        id: incident.id,
        title: incident.title,
        status: incident.status,
        serviceName: incident.service_name,
        createdAt: incident.created_at,
        completedAt: incident.completed_at,
      },
      report: report
        ? {
            rootCause: report.root_cause,
            confidenceScore: report.confidence_score,
            affectedFiles: report.affected_files,
            suggestedFix: report.suggested_fix,
            timeline: report.timeline,
            relevantCommits: report.relevant_commits,
          }
        : null,
    });
  } catch (err) {
    sendError(res, err, 'Failed to get latest incident');
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const incident = await getIncident(req.user!.userId, String(req.params.id));
    if (!incident) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Incident not found' });
      return;
    }
    const report = await getAnalysisReport(incident.id);
    res.json({
      incident: {
        id: incident.id,
        title: incident.title,
        status: incident.status,
        serviceName: incident.service_name,
        progressStep: incident.progress_step,
        logSources: incident.log_sources,
        extractedSignals: incident.extracted_signals,
        createdAt: incident.created_at,
        completedAt: incident.completed_at,
      },
      report: report
        ? {
            rootCause: report.root_cause,
            confidenceScore: report.confidence_score,
            affectedFiles: report.affected_files,
            affectedFunctions: report.affected_functions,
            relevantCommits: report.relevant_commits,
            suggestedFix: report.suggested_fix,
            codeSnippets: report.code_snippets,
            timeline: report.timeline,
            llmModel: report.llm_model,
            createdAt: report.created_at,
          }
        : null,
    });
  } catch (err) {
    sendError(res, err, 'Failed to get incident');
  }
});

router.get('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const incident = await getIncident(req.user!.userId, String(req.params.id));
    if (!incident) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Incident not found' });
      return;
    }
    res.json({
      status: incident.status,
      progressStep: incident.progress_step,
      completedAt: incident.completed_at,
    });
  } catch (err) {
    sendError(res, err, 'Failed to get status');
  }
});

export default router;
