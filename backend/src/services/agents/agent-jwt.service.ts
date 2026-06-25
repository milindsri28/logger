import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { AgentJwtPayload } from '../../types/agent';

export function signAgentToken(agentId: string, userId: string): string {
  const payload: AgentJwtPayload = {
    sub: `agent:${agentId}`,
    userId,
    agentId,
  };
  return jwt.sign(payload, config.agent.jwtSecret, {
    expiresIn: config.agent.jwtExpiresIn,
  } as jwt.SignOptions);
}

export function verifyAgentToken(token: string): AgentJwtPayload {
  return jwt.verify(token, config.agent.jwtSecret) as AgentJwtPayload;
}
