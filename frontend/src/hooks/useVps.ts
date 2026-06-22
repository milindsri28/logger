import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { VpsService } from '@/types';

export function useVpsServices(vpsConnectionId: string | null) {
  return useQuery({
    queryKey: ['vps-services', vpsConnectionId],
    queryFn: () => api<VpsService[]>(`/vps/services?vpsConnectionId=${vpsConnectionId}`),
    enabled: !!vpsConnectionId,
    refetchInterval: 30_000,
  });
}

export function useVpsLogs(
  vpsConnectionId: string | null,
  service: string | null,
  autoRefresh: boolean
) {
  return useQuery({
    queryKey: ['vps-logs', vpsConnectionId, service],
    queryFn: () =>
      api<{ logs: string; fetchedAt: string }>(
        `/vps/logs?vpsConnectionId=${vpsConnectionId}&service=${encodeURIComponent(service!)}`
      ),
    enabled: !!vpsConnectionId && !!service,
    refetchInterval: autoRefresh ? 5_000 : false,
  });
}
