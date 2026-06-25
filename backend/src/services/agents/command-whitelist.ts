import { AgentCommand } from '../../types/agent';
import { ApiError } from '../../utils/api-error';

const CONTAINER_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;
const PM2_APP_NAME_RE = /^[a-zA-Z0-9@._-]+$/;
const SYSTEM_SERVICE_RE = /^(nginx|postgres|postgresql|redis)$/i;
const UNIT_NAME_RE = /^[a-zA-Z0-9@._:-]+$/;

export function validateAgentCommand(
  command: string,
  args: Record<string, unknown>,
  options?: { allowFollow?: boolean }
): AgentCommand {
  switch (command) {
    case 'docker_ps':
      return 'docker_ps';
    case 'pm2_list':
      return 'pm2_list';
    case 'system_discover':
      return 'system_discover';
    case 'docker_logs': {
      const containerId = String(args.containerId || '');
      if (!CONTAINER_ID_RE.test(containerId)) {
        throw new ApiError('INVALID_ARGS', 'Invalid containerId', 400);
      }
      const tail = args.tail !== undefined ? Number(args.tail) : 100;
      if (!Number.isFinite(tail) || tail < 1 || tail > 1000) {
        throw new ApiError('INVALID_ARGS', 'tail must be 1-1000', 400);
      }
      if (args.follow === true && !options?.allowFollow) {
        throw new ApiError('INVALID_ARGS', 'Use GET /agents/:id/logs/stream for follow mode', 400);
      }
      return 'docker_logs';
    }
    case 'pm2_logs': {
      const appName = String(args.appName || '');
      if (!appName || !PM2_APP_NAME_RE.test(appName)) {
        throw new ApiError('INVALID_ARGS', 'Invalid PM2 app name', 400);
      }
      const tail = args.tail !== undefined ? Number(args.tail) : 100;
      if (!Number.isFinite(tail) || tail < 1 || tail > 1000) {
        throw new ApiError('INVALID_ARGS', 'tail must be 1-1000', 400);
      }
      if (args.follow === true && !options?.allowFollow) {
        throw new ApiError('INVALID_ARGS', 'Use GET /agents/:id/logs/stream for follow mode', 400);
      }
      return 'pm2_logs';
    }
    case 'system_logs': {
      const serviceName = String(args.serviceName || args.appName || '');
      if (!serviceName || !SYSTEM_SERVICE_RE.test(serviceName)) {
        throw new ApiError('INVALID_ARGS', 'Invalid system service name', 400);
      }
      const tail = args.tail !== undefined ? Number(args.tail) : 100;
      if (!Number.isFinite(tail) || tail < 1 || tail > 5000) {
        throw new ApiError('INVALID_ARGS', 'tail must be 1-5000', 400);
      }
      if (args.follow === true) {
        throw new ApiError('INVALID_ARGS', 'Live streaming is not supported for system services', 400);
      }
      return 'system_logs';
    }
    case 'systemctl_status': {
      const unit = String(args.unit || '');
      if (!unit || !UNIT_NAME_RE.test(unit)) {
        throw new ApiError('INVALID_ARGS', 'Invalid systemd unit name', 400);
      }
      return 'systemctl_status';
    }
    default:
      throw new ApiError('COMMAND_NOT_ALLOWED', `Command not allowed: ${command}`, 403);
  }
}

export function buildArgv(command: AgentCommand, args: Record<string, unknown>): string[] {
  switch (command) {
    case 'docker_ps':
      return ['docker', 'ps', '-a'];
    case 'pm2_list':
      return ['pm2', 'jlist'];
    case 'system_discover':
      return ['system_discover'];
    case 'docker_logs': {
      const tail = args.tail !== undefined ? String(args.tail) : '100';
      const follow = args.follow === true;
      if (follow) {
        return ['docker', 'logs', '-f', '--tail', tail, String(args.containerId)];
      }
      return ['docker', 'logs', '--tail', tail, String(args.containerId)];
    }
    case 'pm2_logs': {
      const tail = args.tail !== undefined ? String(args.tail) : '100';
      const follow = args.follow === true;
      if (follow) {
        return ['pm2', 'logs', String(args.appName), '--raw', '--lines', tail];
      }
      return ['pm2', 'logs', String(args.appName), '--lines', tail, '--nostream'];
    }
    case 'system_logs':
      return ['system_logs', String(args.serviceName || args.appName)];
    case 'systemctl_status':
      return ['systemctl', 'status', String(args.unit), '--no-pager'];
    default:
      throw new Error(`Unsupported command: ${command}`);
  }
}
