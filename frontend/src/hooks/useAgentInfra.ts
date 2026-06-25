import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { VpsService } from '@/types';

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

export interface AgentServicesResponse {
  services: VpsService[];
  source: 'live' | 'heartbeat';
  wsConnected: boolean;
  discovery: ServiceDiscoveryInfo;
}

function channelLabel(
  channel: DiscoveryChannelInfo,
  okLabel: string,
  emptyLabel: string,
  unavailableLabel: string
): string | null {
  if (channel.status === 'ok') return `${channel.count} ${okLabel}`;
  if (channel.status === 'empty') return emptyLabel;
  if (channel.status === 'unavailable') return unavailableLabel;
  if (channel.message) return `${okLabel}: ${channel.message}`;
  return null;
}

export function formatDiscoveryHint(discovery: ServiceDiscoveryInfo | undefined): string | null {
  if (!discovery) return null;

  const parts = [
    channelLabel(discovery.docker, 'Docker', 'Docker: none', 'Docker N/A'),
    channelLabel(discovery.pm2, 'PM2', 'PM2: none', 'PM2 N/A'),
    channelLabel(discovery.system, 'system', 'System: none probed', 'System N/A'),
  ].filter((p): p is string => !!p);

  return parts.length ? parts.join(' · ') : null;
}

export function emptyServicesMessage(
  discovery: ServiceDiscoveryInfo | undefined,
  allPinned: boolean
): string {
  if (allPinned) return 'All discovered services are already in your list.';
  if (!discovery) return 'No services detected yet. Wait for the agent heartbeat.';

  const hasAny =
    discovery.docker.status === 'ok' ||
    discovery.pm2.status === 'ok' ||
    discovery.system.status === 'ok';

  if (hasAny) return 'No more services to add.';

  return formatDiscoveryHint(discovery) || 'No Docker, PM2, or system services found on this server.';
}

export function useAgentDockerServices(agentId: string | null) {
  return useQuery({
    queryKey: ['agent-docker-services', agentId],
    queryFn: () => api<AgentServicesResponse>(`/agents/${agentId}/services`),
    enabled: !!agentId,
    refetchInterval: 30_000,
  });
}

export function useAgentDockerLogs(
  agentId: string | null,
  serviceName: string | null,
  autoRefresh: boolean,
  lines = 500,
  serviceType?: VpsService['type']
) {
  return useQuery({
    queryKey: ['agent-docker-logs', agentId, serviceName, serviceType, lines],
    queryFn: async () => {
      const params = new URLSearchParams({
        service: serviceName!,
        lines: String(lines),
      });
      if (serviceType === 'pm2' || serviceType === 'docker' || serviceType === 'system') {
        params.set('type', serviceType);
      }
      const result = await api<{ logs: string; fetchedAt: string }>(
        `/agents/${agentId}/logs?${params.toString()}`
      );
      return result;
    },
    enabled: !!agentId && !!serviceName,
    refetchInterval: autoRefresh ? 5_000 : false,
  });
}
