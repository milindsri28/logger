import { Request, Response, NextFunction } from 'express';
import { verifyAgentToken } from '../services/agents/agent-jwt.service';
import { ensureAgentExists } from '../services/agents/agent.service';
import { AgentJwtPayload } from '../types/agent';
import { ApiError } from '../utils/api-error';

export interface AgentRequest extends Request {
  agent?: AgentJwtPayload;
}

export async function agentAuthMiddleware(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Agent authentication required' });
    return;
  }

  try {
    req.agent = verifyAgentToken(header.slice(7));
    await ensureAgentExists(req.agent.agentId);
    next();
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
    res.status(401).json({ error: 'Invalid or expired agent token' });
  }
}
