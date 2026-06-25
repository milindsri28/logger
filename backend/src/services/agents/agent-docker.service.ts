import { WebSocket } from 'ws';
import { queryOne } from '../../config/database';
import { dispatchAgentJob, getAgentConnection, JobResult } from './agent-gateway.service';
import { ApiError } from '../../utils/api-error';

export interface AgentServiceInfo {
  name: string;
  status: 'running' | 'down' | 'warning';
  type: 'docker' | 'pm2' | 'system';
}

export type DiscoveryChannelStatus = 'ok' | 'empty' | 'unavailable' | 'error';

export interface DiscoveryChannelInfo {
  status: DiscoveryChannelStatus;
  count: number;
  message?: string;
}

export interface ServiceDiscoveryInfo {
  docker: DiscoveryChannelInfo;
  pm2: DiscoveryChannelInfo;
  system: DiscoveryChannelInfo;
}

interface AgentMetricsRow {
  docker_containers: unknown;
  pm2_processes: unknown;
  system_services: unknown;
  recorded_at: string;
}

function mapDockerContainer(container: unknown): AgentServiceInfo | null {
  if (!container || typeof container !== 'object') return null;
  const row = container as Record<string, unknown>;
  const name = String(row.Names || row.names || '').trim();
  if (!name) return null;

  const state = String(row.State || row.state || '').toLowerCase();
  let status: AgentServiceInfo['status'] = 'warning';
  if (state === 'running') status = 'running';
  else if (state === 'exited' || state === 'dead' || state === 'created') status = 'down';

  return { name, status, type: 'docker' };
}

function mapPM2Process(app: unknown): AgentServiceInfo | null {
  if (!app || typeof app !== 'object') return null;
  const row = app as Record<string, unknown>;
  const name = String(row.name || '').trim();
  if (!name) return null;

  const env = row.pm2_env as Record<string, unknown> | undefined;
  const st = String(env?.status || 'unknown').toLowerCase();
  let status: AgentServiceInfo['status'] = 'down';
  if (st === 'online') status = 'running';
  else if (st === 'stopping' || st === 'launching') status = 'warning';

  return { name, status, type: 'pm2' };
}

function mapSystemService(item: unknown): AgentServiceInfo | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  const name = String(row.name || '').trim();
  if (!name) return null;
  const st = String(row.status || 'down').toLowerCase();
  let status: AgentServiceInfo['status'] = 'down';
  if (st === 'running' || st === 'active' || st === 'online') status = 'running';
  else if (st === 'warning') status = 'warning';
  return { name, status, type: 'system' };
}

function parseDockerPsStdout(stdout: string): AgentServiceInfo[] {
  const lines = stdout.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];

  return lines.slice(1).map((line) => {
    const parts = line.trim().split(/\s+/);
    const name = parts[parts.length - 1] || 'unknown';
    const status: AgentServiceInfo['status'] = line.includes('Up')
      ? 'running'
      : line.includes('Exit')
        ? 'down'
        : 'warning';
    return { name, status, type: 'docker' as const };
  });
}

function parsePM2JlistStdout(stdout: string): AgentServiceInfo[] {
  try {
    const apps = JSON.parse(stdout) as unknown[];
    if (!Array.isArray(apps)) return [];
    return apps
      .map(mapPM2Process)
      .filter((svc): svc is AgentServiceInfo => svc !== null);
  } catch {
    return [];
  }
}

function parseSystemDiscoverStdout(stdout: string): AgentServiceInfo[] {
  try {
    const apps = JSON.parse(stdout) as unknown[];
    if (!Array.isArray(apps)) return [];
    return apps
      .map(mapSystemService)
      .filter((svc): svc is AgentServiceInfo => svc !== null);
  } catch {
    return [];
  }
}

function mergeServices(lists: AgentServiceInfo[][]): AgentServiceInfo[] {
  const byName = new Map<string, AgentServiceInfo>();
  for (const list of lists) {
    for (const svc of list) {
      if (!byName.has(svc.name)) {
        byName.set(svc.name, svc);
      }
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function channelFromJobResult(
  result: PromiseSettledResult<JobResult>,
  parse: (stdout: string) => AgentServiceInfo[],
  unavailableHint: string
): { services: AgentServiceInfo[]; info: DiscoveryChannelInfo } {
  if (result.status === 'rejected') {
    const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
    const unavailable =
      /not found|not allowed|not connected|timed out/i.test(msg) ||
      msg.includes('pm2 not found') ||
      msg.includes('docker not found');
    return {
      services: [],
      info: {
        status: unavailable ? 'unavailable' : 'error',
        count: 0,
        message: msg,
      },
    };
  }

  const { exitCode, stdout, stderr } = result.value;
  if (exitCode !== 0) {
    const msg = stderr.trim() || `Command exited with code ${exitCode}`;
    return {
      services: [],
      info: {
        status: /not found|No such file/i.test(msg) ? 'unavailable' : 'error',
        count: 0,
        message: msg,
      },
    };
  }

  const services = parse(stdout);
  if (services.length === 0) {
    return {
      services: [],
      info: {
        status: 'empty',
        count: 0,
        message: unavailableHint,
      },
    };
  }

  return {
    services,
    info: { status: 'ok', count: services.length },
  };
}

function discoveryFromHeartbeat(row: AgentMetricsRow): ServiceDiscoveryInfo {
  const dockerList = Array.isArray(row.docker_containers) ? row.docker_containers : [];
  const pm2List = Array.isArray(row.pm2_processes) ? row.pm2_processes : [];
  const systemList = Array.isArray(row.system_services) ? row.system_services : [];

  const dockerServices = dockerList
    .map(mapDockerContainer)
    .filter((svc): svc is AgentServiceInfo => svc !== null);
  const pm2Services = pm2List
    .map(mapPM2Process)
    .filter((svc): svc is AgentServiceInfo => svc !== null);
  const systemServices = systemList
    .map(mapSystemService)
    .filter((svc): svc is AgentServiceInfo => svc !== null);

  return {
    docker: {
      status: dockerServices.length > 0 ? 'ok' : 'empty',
      count: dockerServices.length,
      message: dockerServices.length === 0 ? 'No Docker containers in last heartbeat' : undefined,
    },
    pm2: {
      status: pm2Services.length > 0 ? 'ok' : 'empty',
      count: pm2Services.length,
      message: pm2Services.length === 0 ? 'No PM2 processes in last heartbeat' : undefined,
    },
    system: {
      status: systemServices.length > 0 ? 'ok' : 'empty',
      count: systemServices.length,
      message: systemServices.length === 0 ? 'No system services probed in last heartbeat' : undefined,
    },
  };
}

async function getLatestMetrics(agentId: string): Promise<AgentMetricsRow | null> {
  return queryOne<AgentMetricsRow>(
    `SELECT docker_containers, pm2_processes, system_services, recorded_at
     FROM agent_metrics
     WHERE agent_id = $1
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [agentId]
  );
}

export function isAgentWsConnected(agentId: string): boolean {
  const ws = getAgentConnection(agentId);
  return ws?.readyState === WebSocket.OPEN;
}

async function fetchLiveServices(agentId: string): Promise<{
  services: AgentServiceInfo[];
  discovery: ServiceDiscoveryInfo;
}> {
  const results = await Promise.allSettled([
    dispatchAgentJob(agentId, { command: 'docker_ps', args: {} }),
    dispatchAgentJob(agentId, { command: 'pm2_list', args: {} }),
    dispatchAgentJob(agentId, { command: 'system_discover', args: {} }),
  ]);

  const docker = channelFromJobResult(
    results[0],
    parseDockerPsStdout,
    'No Docker containers found'
  );
  const pm2 = channelFromJobResult(
    results[1],
    parsePM2JlistStdout,
    'No PM2 processes running'
  );
  const system = channelFromJobResult(
    results[2],
    parseSystemDiscoverStdout,
    'No system services probed'
  );

  return {
    services: mergeServices([docker.services, pm2.services, system.services]),
    discovery: {
      docker: docker.info,
      pm2: pm2.info,
      system: system.info,
    },
  };
}

function servicesFromHeartbeat(row: AgentMetricsRow): AgentServiceInfo[] {
  const docker = Array.isArray(row.docker_containers) ? row.docker_containers : [];
  const pm2 = Array.isArray(row.pm2_processes) ? row.pm2_processes : [];
  const system = Array.isArray(row.system_services) ? row.system_services : [];

  return mergeServices([
    docker.map(mapDockerContainer).filter((svc): svc is AgentServiceInfo => svc !== null),
    pm2.map(mapPM2Process).filter((svc): svc is AgentServiceInfo => svc !== null),
    system.map(mapSystemService).filter((svc): svc is AgentServiceInfo => svc !== null),
  ]);
}

const emptyDiscovery = (): ServiceDiscoveryInfo => ({
  docker: { status: 'unavailable', count: 0, message: 'Not queried yet' },
  pm2: { status: 'unavailable', count: 0, message: 'Not queried yet' },
  system: { status: 'unavailable', count: 0, message: 'Not queried yet' },
});

export async function getAgentDockerServices(agentId: string): Promise<{
  services: AgentServiceInfo[];
  source: 'live' | 'heartbeat';
  wsConnected: boolean;
  discovery: ServiceDiscoveryInfo;
}> {
  const wsConnected = isAgentWsConnected(agentId);
  let discovery = emptyDiscovery();

  if (wsConnected) {
    try {
      const live = await fetchLiveServices(agentId);
      return { services: live.services, source: 'live', wsConnected: true, discovery: live.discovery };
    } catch (err) {
      discovery = {
        docker: {
          status: 'error',
          count: 0,
          message: err instanceof Error ? err.message : 'Live discovery failed',
        },
        pm2: {
          status: 'error',
          count: 0,
          message: err instanceof Error ? err.message : 'Live discovery failed',
        },
        system: {
          status: 'error',
          count: 0,
          message: err instanceof Error ? err.message : 'Live discovery failed',
        },
      };
    }
  } else {
    discovery = {
      docker: { status: 'unavailable', count: 0, message: 'WebSocket offline — using heartbeat cache' },
      pm2: { status: 'unavailable', count: 0, message: 'WebSocket offline — using heartbeat cache' },
      system: { status: 'unavailable', count: 0, message: 'WebSocket offline — using heartbeat cache' },
    };
  }

  const metrics = await getLatestMetrics(agentId);
  if (metrics) {
    const services = servicesFromHeartbeat(metrics);
    const heartbeatDiscovery = discoveryFromHeartbeat(metrics);
    return {
      services,
      source: 'heartbeat',
      wsConnected,
      discovery: wsConnected ? { ...discovery, ...heartbeatDiscovery } : heartbeatDiscovery,
    };
  }

  if (!wsConnected) {
    throw new ApiError(
      'AGENT_WS_OFFLINE',
      'Agent is offline. Check the agent service on your server and ensure the tunnel is running.',
      503
    );
  }

  return { services: [], source: 'live', wsConnected: true, discovery };
}

export async function resolveAgentServiceType(
  agentId: string,
  serviceName: string
): Promise<'docker' | 'pm2' | 'system'> {
  const { services } = await getAgentDockerServices(agentId);
  const match = services.find((s) => s.name === serviceName);
  return match?.type ?? 'docker';
}

export function formatDiscoverySummary(discovery: ServiceDiscoveryInfo): string {
  const parts: string[] = [];

  if (discovery.docker.status === 'ok') parts.push(`${discovery.docker.count} Docker`);
  else if (discovery.docker.status === 'empty') parts.push('Docker: none');
  else if (discovery.docker.status === 'unavailable') parts.push('Docker N/A');

  if (discovery.pm2.status === 'ok') parts.push(`${discovery.pm2.count} PM2`);
  else if (discovery.pm2.status === 'empty') parts.push('PM2: none');
  else if (discovery.pm2.status === 'unavailable') parts.push('PM2 N/A');

  if (discovery.system.status === 'ok') parts.push(`${discovery.system.count} system`);
  else if (discovery.system.status === 'empty') parts.push('System: none');
  else if (discovery.system.status === 'unavailable') parts.push('System N/A');

  return parts.join(' · ');
}
