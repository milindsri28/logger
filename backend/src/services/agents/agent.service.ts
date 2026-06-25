import { query, queryOne } from '../../config/database';
import { Agent } from '../../types/agent';
import { ApiError } from '../../utils/api-error';

export async function getAgentById(agentId: string): Promise<Agent | null> {
  return queryOne<Agent>('SELECT * FROM agents WHERE id = $1', [agentId]);
}

export async function ensureAgentExists(agentId: string): Promise<Agent> {
  const agent = await getAgentById(agentId);
  if (!agent) {
    throw new ApiError(
      'AGENT_NOT_FOUND',
      'Agent no longer registered; obtain a new registration token',
      401
    );
  }
  return agent;
}

export async function listAgentsForUser(userId: string): Promise<Agent[]> {
  return query<Agent>(
    'SELECT * FROM agents WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
}

export async function getAgentForUser(userId: string, agentId: string): Promise<Agent | null> {
  return queryOne<Agent>(
    'SELECT * FROM agents WHERE id = $1 AND user_id = $2',
    [agentId, userId]
  );
}

export async function updateAgentStatus(agentId: string, status: string): Promise<void> {
  await query(
    'UPDATE agents SET status = $1, updated_at = NOW() WHERE id = $2',
    [status, agentId]
  );
}

export async function deleteAgentForUser(userId: string, agentId: string): Promise<void> {
  const agent = await getAgentForUser(userId, agentId);
  if (!agent) {
    throw new Error('Agent not found');
  }

  await query('DELETE FROM incidents WHERE agent_id = $1', [agentId]);
  await query('DELETE FROM agents WHERE id = $1 AND user_id = $2', [agentId, userId]);
}

export async function touchAgentLastSeen(agentId: string): Promise<void> {
  await query(
    `UPDATE agents SET last_seen_at = NOW(), status = 'connected', updated_at = NOW() WHERE id = $1`,
    [agentId]
  );
}
