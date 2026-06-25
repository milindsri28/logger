import { WebSocket } from 'ws';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { pool, query, queryOne } from '../../config/database';
import { Agent, AgentJobPayload, AgentToken, WsFrame } from '../../types/agent';
import { config } from '../../config';
import { signAgentToken } from './agent-jwt.service';
import { ensureAgentExists, touchAgentLastSeen, updateAgentStatus } from './agent.service';
import { logger } from '../../utils/logger';
import { ApiError } from '../../utils/api-error';

interface PendingJob {
  resolve: (result: JobResult) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
  stdout: string;
  stderr: string;
}

interface FollowJob {
  subscribers: Set<(chunk: { stream: string; data: string }) => void>;
  completeResolve: () => void;
  completeReject: (err: Error) => void;
  completePromise: Promise<void>;
}

export interface JobResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface FollowJobHandle {
  jobId: string;
  subscribe: (cb: (chunk: { stream: string; data: string }) => void) => () => void;
  completed: Promise<void>;
  cancel: () => void;
}

const connections = new Map<string, WebSocket>();
const pendingJobs = new Map<string, PendingJob>();
const followJobs = new Map<string, FollowJob>();

const JOB_TIMEOUT_MS = 120_000;

export function getAgentConnection(agentId: string): WebSocket | undefined {
  return connections.get(agentId);
}

export function registerAgentConnection(agentId: string, ws: WebSocket): void {
  const existing = connections.get(agentId);
  if (existing && existing !== ws) {
    try {
      existing.close();
    } catch {
      /* ignore */
    }
  }
  connections.set(agentId, ws);
  touchAgentLastSeen(agentId).catch((err) =>
    logger.error('AGENT_GW', 'touchAgentLastSeen failed', String(err))
  );
}

export function unregisterAgentConnection(agentId: string, ws: WebSocket): void {
  if (connections.get(agentId) === ws) {
    connections.delete(agentId);
    updateAgentStatus(agentId, 'disconnected').catch(() => undefined);
  }
}

export async function registerAgent(
  plainToken: string,
  hostname: string,
  os: string | undefined
): Promise<{ agentId: string; jwt: string; wsUrl: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
    const tokenResult = await client.query<AgentToken>(
      `SELECT * FROM agent_tokens
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash]
    );
    const row = tokenResult.rows[0];
    if (!row) {
      throw new ApiError('INVALID_TOKEN', 'Invalid or expired agent token', 401);
    }
    if (row.used_at) {
      throw new ApiError('INVALID_TOKEN', 'Agent token already used', 409);
    }

    const agentResult = await client.query<Agent>(
      `INSERT INTO agents (user_id, agent_token_id, hostname, os, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [row.user_id, row.id, hostname, os || null]
    );
    const agent = agentResult.rows[0];
    if (!agent) throw new Error('Failed to create agent');

    await client.query('UPDATE agent_tokens SET used_at = NOW() WHERE id = $1', [row.id]);
    await client.query('COMMIT');

    const jwt = signAgentToken(agent.id, row.user_id);
    return { agentId: agent.id, jwt, wsUrl: config.wsUrl };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function recordHeartbeat(
  agentId: string,
  payload: {
    cpu?: number;
    memory?: { usedMb?: number; totalMb?: number };
    disk?: { usedPct?: number };
    load?: { '1'?: number };
    dockerContainers?: unknown[];
    pm2Processes?: unknown[];
    systemServices?: unknown[];
  }
): Promise<void> {
  await ensureAgentExists(agentId);
  await touchAgentLastSeen(agentId);
  await query(
    `INSERT INTO agent_metrics
      (agent_id, cpu_percent, memory_used_mb, memory_total_mb, disk_used_pct, load_1, docker_containers, pm2_processes, system_services)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      agentId,
      payload.cpu ?? null,
      payload.memory?.usedMb ?? null,
      payload.memory?.totalMb ?? null,
      payload.disk?.usedPct ?? null,
      payload.load?.['1'] ?? null,
      JSON.stringify(payload.dockerContainers ?? []),
      JSON.stringify(payload.pm2Processes ?? []),
      JSON.stringify(payload.systemServices ?? []),
    ]
  );
}

function fanOutChunk(jobId: string, payload: { stream?: string; data?: string }): void {
  const follow = followJobs.get(jobId);
  if (!follow) return;
  const chunk = { stream: payload.stream || 'stdout', data: payload.data || '' };
  follow.subscribers.forEach((cb) => cb(chunk));
}

function completeFollowJob(jobId: string): void {
  const follow = followJobs.get(jobId);
  if (!follow) return;
  follow.completeResolve();
  followJobs.delete(jobId);
}

function failFollowJob(jobId: string, message: string): void {
  const follow = followJobs.get(jobId);
  if (!follow) return;
  follow.completeReject(new Error(message));
  followJobs.delete(jobId);
}

export function handleAgentWsMessage(agentId: string, raw: string): void {
  let frame: WsFrame;
  try {
    frame = JSON.parse(raw) as WsFrame;
  } catch {
    return;
  }

  if (frame.type === 'pong') return;

  if (frame.type === 'heartbeat') {
    recordHeartbeat(agentId, (frame.payload || {}) as Parameters<typeof recordHeartbeat>[1]).catch(
      (err) => {
        if (err instanceof ApiError && err.code === 'AGENT_NOT_FOUND') {
          logger.warn('AGENT_GW', 'Orphaned agent disconnected', agentId);
          const ws = connections.get(agentId);
          if (ws) {
            try {
              ws.close(4001, 'agent_orphaned');
            } catch {
              /* ignore */
            }
          }
          return;
        }
        logger.warn('AGENT_GW', 'Heartbeat persist failed', String(err));
      }
    );
    return;
  }

  if (frame.type === 'job_chunk' && frame.id) {
    const payload = frame.payload as { stream?: string; data?: string };
    fanOutChunk(frame.id, payload);

    const job = pendingJobs.get(frame.id);
    if (!job) return;
    if (payload.stream === 'stderr') job.stderr += payload.data || '';
    else job.stdout += payload.data || '';
    return;
  }

  if (frame.type === 'job_complete' && frame.id) {
    if (followJobs.has(frame.id)) {
      completeFollowJob(frame.id);
      return;
    }

    const job = pendingJobs.get(frame.id);
    if (!job) return;
    clearTimeout(job.timeout);
    pendingJobs.delete(frame.id);
    const payload = frame.payload as { exitCode?: number };
    job.resolve({
      exitCode: payload.exitCode ?? 0,
      stdout: job.stdout,
      stderr: job.stderr,
    });
    return;
  }

  if (frame.type === 'job_error' && frame.id) {
    const payload = frame.payload as { message?: string };
    if (followJobs.has(frame.id)) {
      failFollowJob(frame.id, payload.message || 'Agent job failed');
      return;
    }

    const job = pendingJobs.get(frame.id);
    if (!job) return;
    clearTimeout(job.timeout);
    pendingJobs.delete(frame.id);
    job.reject(new Error(payload.message || 'Agent job failed'));
  }
}

export function dispatchAgentJob(
  agentId: string,
  job: AgentJobPayload
): Promise<JobResult> {
  const ws = connections.get(agentId);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error('Agent is not connected'));
  }

  const jobId = uuidv4();
  const frame: WsFrame<AgentJobPayload> = {
    type: 'job',
    id: jobId,
    ts: new Date().toISOString(),
    payload: job,
  };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingJobs.delete(jobId);
      reject(new Error('Agent job timed out'));
    }, JOB_TIMEOUT_MS);

    pendingJobs.set(jobId, { resolve, reject, timeout, stdout: '', stderr: '' });
    ws.send(JSON.stringify(frame));
  });
}

export function startFollowJob(agentId: string, job: AgentJobPayload): FollowJobHandle {
  const ws = connections.get(agentId);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('Agent is not connected');
  }

  const jobId = uuidv4();
  let completeResolve!: () => void;
  let completeReject!: (err: Error) => void;
  const completePromise = new Promise<void>((resolve, reject) => {
    completeResolve = resolve;
    completeReject = reject;
  });

  followJobs.set(jobId, {
    subscribers: new Set(),
    completeResolve,
    completeReject,
    completePromise,
  });

  const frame: WsFrame<AgentJobPayload> = {
    type: 'job',
    id: jobId,
    ts: new Date().toISOString(),
    payload: job,
  };
  ws.send(JSON.stringify(frame));

  return {
    jobId,
    subscribe: (cb) => {
      const state = followJobs.get(jobId);
      if (!state) return () => undefined;
      state.subscribers.add(cb);
      return () => state.subscribers.delete(cb);
    },
    completed: completePromise,
    cancel: () => sendJobCancel(agentId, jobId),
  };
}

export function sendJobCancel(agentId: string, jobId: string): void {
  const ws = connections.get(agentId);
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'job_cancel', id: jobId, ts: new Date().toISOString() }));
  }

  const follow = followJobs.get(jobId);
  if (follow) {
    follow.completeReject(new Error('cancelled'));
    followJobs.delete(jobId);
  }

  const batch = pendingJobs.get(jobId);
  if (batch) {
    clearTimeout(batch.timeout);
    pendingJobs.delete(jobId);
    batch.reject(new Error('cancelled'));
  }
}

export function startAgentStaleChecker(): void {
  const intervalMs = config.agent.heartbeatTimeoutSec * 1000;
  setInterval(async () => {
    try {
      await query(
        `UPDATE agents SET status = 'disconnected', updated_at = NOW()
         WHERE status = 'connected'
           AND (last_seen_at IS NULL OR last_seen_at < NOW() - ($1 || ' seconds')::interval)`,
        [String(config.agent.heartbeatTimeoutSec)]
      );
    } catch (err) {
      logger.error('AGENT_GW', 'Stale checker failed', String(err));
    }
  }, intervalMs);
}

export function sendPing(agentId: string): void {
  const ws = connections.get(agentId);
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping', ts: new Date().toISOString() }));
  }
}
