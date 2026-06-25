import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface IntegrationsStatus {
  github: {
    connected: boolean;
    accountLogin?: string;
    connectedAt?: string;
  };
  infrastructure: {
    agents: {
      id: string;
      hostname: string;
      os: string | null;
      status: string;
      lastSeenAt: string | null;
    }[];
    connectedCount: number;
  };
}

export function useIntegrationsStatus(enabled = true) {
  return useQuery({
    queryKey: ['integrations-status'],
    queryFn: () => api<IntegrationsStatus>('/integrations/status'),
    enabled,
    refetchInterval: (query) => {
      const agents = query.state.data?.infrastructure.agents ?? [];
      const hasPending = agents.some((a) => a.status !== 'connected');
      return hasPending ? 5000 : false;
    },
  });
}
