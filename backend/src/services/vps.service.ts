import { NodeSSH } from 'node-ssh';
import { query, queryOne } from '../config/database';
import { encrypt, decrypt } from '../utils/encryption';
import { VpsConnection } from '../types';

export type LogSource = 'pm2' | 'nginx' | 'docker' | 'node';

/** Strip accidental "ssh user@host" paste — host must be IP or hostname only. */
export function sanitizeSshHost(input: string): string {
  let host = input.trim();
  host = host.replace(/^ssh\s+/i, '');
  const atIdx = host.lastIndexOf('@');
  if (atIdx !== -1) host = host.slice(atIdx + 1);
  host = host.replace(/:\d+$/, '').replace(/\/$/, '');
  return host.trim();
}

export function sanitizeSshUsername(input: string): string {
  let user = input.trim();
  user = user.replace(/^ssh\s+/i, '');
  const atMatch = user.match(/^([^@\s]+)@/);
  if (atMatch) return atMatch[1];
  if (user.includes('@')) return user.split('@')[0];
  return user;
}

export interface FetchLogsOptions {
  sources: LogSource[];
  lines?: number;
  serviceName?: string;
  containerName?: string;
}

export async function createVpsConnection(
  userId: string,
  data: {
    name: string;
    host: string;
    port: number;
    username: string;
    authType: 'key' | 'password';
    credential: string;
  }
): Promise<VpsConnection> {
  const host = sanitizeSshHost(data.host);
  const username = sanitizeSshUsername(data.username);

  if (!host || /[@\s]/.test(host)) {
    throw new Error('Invalid host. Use only the IP address (e.g. 145.223.19.101), not "ssh root@..."');
  }

  const conn = await queryOne<VpsConnection>(
    `INSERT INTO vps_connections (user_id, name, host, port, username, auth_type, credentials_enc)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [userId, data.name, host, data.port, username, data.authType, encrypt(data.credential)]
  );
  if (!conn) throw new Error('Failed to create VPS connection');
  return conn;
}

export async function getVpsConnections(userId: string): Promise<VpsConnection[]> {
  return query<VpsConnection>('SELECT * FROM vps_connections WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
}

export async function getVpsConnection(userId: string, id: string): Promise<VpsConnection | null> {
  return queryOne<VpsConnection>('SELECT * FROM vps_connections WHERE id = $1 AND user_id = $2', [id, userId]);
}

export async function deleteVpsConnection(userId: string, id: string): Promise<void> {
  await query('DELETE FROM vps_connections WHERE id = $1 AND user_id = $2', [id, userId]);
}

async function connectSsh(conn: VpsConnection): Promise<NodeSSH> {
  const ssh = new NodeSSH();
  const credential = decrypt(conn.credentials_enc);
  const host = sanitizeSshHost(conn.host);
  const username = sanitizeSshUsername(conn.username);

  const connectConfig: Parameters<NodeSSH['connect']>[0] = {
    host,
    port: conn.port,
    username,
    readyTimeout: 30000,
  };

  if (conn.auth_type === 'key') {
    connectConfig.privateKey = credential;
  } else {
    connectConfig.password = credential;
  }

  await ssh.connect(connectConfig);
  return ssh;
}

export async function testConnection(conn: VpsConnection): Promise<{ success: boolean; info?: string; error?: string }> {
  let ssh: NodeSSH | null = null;
  try {
    ssh = await connectSsh(conn);
    const result = await ssh.execCommand('echo ok && uname -a');
    if (result.code !== 0) {
      return { success: false, error: result.stderr || 'Command failed' };
    }
    return { success: true, info: result.stdout.trim() };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Connection failed' };
  } finally {
    ssh?.dispose();
  }
}

export async function fetchLogs(
  conn: VpsConnection,
  options: FetchLogsOptions
): Promise<Record<string, string>> {
  const ssh = await connectSsh(conn);
  const lines = options.lines || 500;
  const logs: Record<string, string> = {};

  try {
    for (const source of options.sources) {
      const command = buildLogCommand(source, lines, options.serviceName, options.containerName);
      const result = await ssh.execCommand(command);
      logs[source] = result.stdout || result.stderr || `No output from ${source}`;
    }
  } finally {
    ssh.dispose();
  }

  return logs;
}

function buildLogCommand(
  source: LogSource,
  lines: number,
  serviceName?: string,
  containerName?: string
): string {
  switch (source) {
    case 'pm2':
      if (serviceName) {
        return `pm2 logs ${serviceName} --lines ${lines} --nostream 2>&1 || pm2 logs --lines ${lines} --nostream 2>&1`;
      }
      return `pm2 logs --lines ${lines} --nostream 2>&1`;

    case 'node':
      if (serviceName) {
        return `tail -n ${lines} ~/.pm2/logs/${serviceName}-error.log 2>/dev/null || tail -n ${lines} ~/.pm2/logs/${serviceName}-out.log 2>/dev/null || echo "No node logs found for ${serviceName}"`;
      }
      return `tail -n ${lines} ~/.pm2/logs/*-error.log 2>/dev/null || echo "No PM2 error logs found"`;

    case 'nginx':
      return `sudo tail -n ${lines} /var/log/nginx/error.log 2>/dev/null; sudo tail -n ${lines} /var/log/nginx/access.log 2>/dev/null || tail -n ${lines} /var/log/nginx/error.log 2>/dev/null || echo "Nginx logs not accessible"`;

    case 'docker':
      if (containerName) {
        return `docker logs --tail ${lines} ${containerName} 2>&1`;
      }
      return `docker ps --format '{{.Names}}' 2>/dev/null | head -1 | xargs -I{} docker logs --tail ${lines} {} 2>&1 || echo "No docker containers found"`;

    default:
      return `echo "Unknown log source: ${source}"`;
  }
}

export function formatLogs(logs: Record<string, string>): string {
  return Object.entries(logs)
    .map(([source, content]) => `=== ${source.toUpperCase()} LOGS ===\n${content}`)
    .join('\n\n');
}

export interface VpsServiceInfo {
  name: string;
  status: 'running' | 'down' | 'warning';
  type: 'pm2' | 'docker' | 'system';
}

export async function listVpsServices(userId: string, vpsConnectionId: string): Promise<VpsServiceInfo[]> {
  const conn = await getVpsConnection(userId, vpsConnectionId);
  if (!conn) throw new Error('VPS connection not found');

  const ssh = await connectSsh(conn);
  try {
    const services: VpsServiceInfo[] = [];

    const pm2Result = await ssh.execCommand('pm2 jlist 2>/dev/null');
    if (pm2Result.stdout) {
      try {
        const apps = JSON.parse(pm2Result.stdout) as Array<{ name: string; pm2_env?: { status?: string } }>;
        for (const app of apps) {
          const st = app.pm2_env?.status || 'unknown';
          services.push({
            name: app.name,
            status: st === 'online' ? 'running' : st === 'stopping' || st === 'launching' ? 'warning' : 'down',
            type: 'pm2',
          });
        }
      } catch {
        // pm2 not json
      }
    }

    const dockerResult = await ssh.execCommand(
      `docker ps -a --format '{{.Names}}|{{.Status}}' 2>/dev/null`
    );
    if (dockerResult.stdout) {
      for (const line of dockerResult.stdout.split('\n').filter(Boolean)) {
        const [name, statusText] = line.split('|');
        if (!name) continue;
        const running = statusText?.toLowerCase().startsWith('up');
        services.push({
          name,
          status: running ? 'running' : statusText?.includes('Restarting') ? 'warning' : 'down',
          type: 'docker',
        });
      }
    }

    const systemChecks = [
      { name: 'nginx', cmd: 'systemctl is-active nginx 2>/dev/null || pgrep -x nginx >/dev/null && echo active || echo inactive' },
      { name: 'postgres', cmd: 'systemctl is-active postgresql 2>/dev/null || docker ps --format "{{.Names}}" 2>/dev/null | grep -i postgres | head -1 | xargs -I{} echo active || echo inactive' },
      { name: 'redis', cmd: 'systemctl is-active redis 2>/dev/null || systemctl is-active redis-server 2>/dev/null || docker ps --format "{{.Names}}" 2>/dev/null | grep -i redis | head -1 | xargs -I{} echo active || echo inactive' },
    ];

    for (const check of systemChecks) {
      if (services.some((s) => s.name.toLowerCase().includes(check.name))) continue;
      const result = await ssh.execCommand(check.cmd);
      const out = (result.stdout || '').trim().toLowerCase();
      services.push({
        name: check.name,
        status: out.includes('active') ? 'running' : 'down',
        type: 'system',
      });
    }

    if (services.length === 0) {
      services.push({ name: 'pm2', status: 'warning', type: 'system' });
    }

    return services;
  } finally {
    ssh.dispose();
  }
}

export async function getServiceLogs(
  userId: string,
  vpsConnectionId: string,
  service: string,
  lines = 300
): Promise<string> {
  const conn = await getVpsConnection(userId, vpsConnectionId);
  if (!conn) throw new Error('VPS connection not found');

  const ssh = await connectSsh(conn);
  try {
    const svc = service.toLowerCase();
    let command: string;

    if (svc === 'nginx') {
      command = `tail -n ${lines} /var/log/nginx/error.log 2>/dev/null; echo "---"; tail -n ${lines} /var/log/nginx/access.log 2>/dev/null`;
    } else if (svc === 'postgres' || svc === 'postgresql') {
      command = `docker logs --tail ${lines} $(docker ps --format '{{.Names}}' 2>/dev/null | grep -i postgres | head -1) 2>&1 || journalctl -u postgresql -n ${lines} --no-pager 2>/dev/null || echo "No postgres logs found"`;
    } else if (svc === 'redis') {
      command = `docker logs --tail ${lines} $(docker ps --format '{{.Names}}' 2>/dev/null | grep -i redis | head -1) 2>&1 || journalctl -u redis -n ${lines} --no-pager 2>/dev/null || echo "No redis logs found"`;
    } else {
      const dockerCheck = await ssh.execCommand(`docker ps --format '{{.Names}}' 2>/dev/null | grep -x '${service}'`);
      if (dockerCheck.stdout.trim()) {
        command = `docker logs --tail ${lines} ${service} 2>&1`;
      } else {
        command = `pm2 logs ${service} --lines ${lines} --nostream 2>&1 || tail -n ${lines} ~/.pm2/logs/${service}-error.log 2>/dev/null || tail -n ${lines} ~/.pm2/logs/${service}-out.log 2>/dev/null || echo "No logs found for ${service}"`;
      }
    }

    const result = await ssh.execCommand(command);
    return result.stdout || result.stderr || `No logs for ${service}`;
  } finally {
    ssh.dispose();
  }
}
