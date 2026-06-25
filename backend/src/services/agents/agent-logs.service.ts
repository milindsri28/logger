import { dispatchAgentJob } from './agent-gateway.service';
import { isAgentWsConnected, resolveAgentServiceType } from './agent-docker.service';
import { ApiError } from '../../utils/api-error';

export async function fetchAgentServiceLogs(
  agentId: string,
  serviceName: string,
  lines = 500,
  serviceType?: 'docker' | 'pm2' | 'system'
): Promise<string> {
  if (!isAgentWsConnected(agentId)) {
    throw new ApiError(
      'AGENT_WS_OFFLINE',
      'Agent live channel is offline. Restart the agent or check the WebSocket tunnel.',
      503
    );
  }

  const type = serviceType ?? (await resolveAgentServiceType(agentId, serviceName));

  let result;
  if (type === 'pm2') {
    result = await dispatchAgentJob(agentId, {
      command: 'pm2_logs',
      args: { appName: serviceName, tail: lines },
    });
  } else if (type === 'system') {
    result = await dispatchAgentJob(agentId, {
      command: 'system_logs',
      args: { serviceName, tail: lines },
    });
  } else {
    result = await dispatchAgentJob(agentId, {
      command: 'docker_logs',
      args: { containerId: serviceName, tail: lines },
    });
  }

  if (result.exitCode !== 0) {
    throw new ApiError(
      'LOG_FETCH_FAILED',
      result.stderr || result.stdout || `Failed to fetch ${type} logs from agent`,
      502
    );
  }

  return [result.stdout, result.stderr].filter(Boolean).join('\n');
}
