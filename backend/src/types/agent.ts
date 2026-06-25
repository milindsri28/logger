export interface AgentJwtPayload {
  sub: string;
  userId: string;
  agentId: string;
}

export type AgentCommand =
  | 'docker_ps'
  | 'docker_logs'
  | 'pm2_list'
  | 'pm2_logs'
  | 'system_discover'
  | 'system_logs'
  | 'systemctl_status';

export interface AgentJobPayload {
  command: AgentCommand;
  args: Record<string, unknown>;
}

export type WsFrameType =
  | 'ping'
  | 'pong'
  | 'heartbeat'
  | 'job'
  | 'job_chunk'
  | 'job_complete'
  | 'job_error'
  | 'job_cancel'
  | 'ack';

export interface WsFrame<T = unknown> {
  type: WsFrameType;
  id?: string;
  ts?: string;
  payload?: T;
}

export interface AgentToken {
  id: string;
  user_id: string;
  token_hash: string;
  label: string;
  expires_at: Date;
  used_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

export interface Agent {
  id: string;
  user_id: string;
  agent_token_id: string | null;
  hostname: string;
  os: string | null;
  status: string;
  last_seen_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface AgentMetric {
  id: string;
  agent_id: string;
  recorded_at: Date;
  cpu_percent: number | null;
  memory_used_mb: number | null;
  memory_total_mb: number | null;
  disk_used_pct: number | null;
  load_1: number | null;
  docker_containers: unknown;
}

export interface RepositoryIntegration {
  id: string;
  user_id: string;
  provider: string;
  provider_account_id: string;
  provider_account_login: string;
  access_token_enc: string;
  refresh_token_enc: string | null;
  scopes: string[];
  expires_at: Date | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}
