import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface SetupStatus {
  hasGithubToken: boolean;
  hasRepo: boolean;
  repoReady: boolean;
  hasVps: boolean;
  canUseWorkspace: boolean;
  nextStep: 'github' | 'vps' | 'wait_clone' | 'workspace';
  pendingRepo?: {
    id: string;
    cloneStatus: string;
    indexStatus: string;
    failureReason?: string | null;
  };
}

export function useSetupStatus(enabled = true) {
  return useQuery({
    queryKey: ['setup-status'],
    queryFn: () => api<SetupStatus>('/setup/status'),
    enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.nextStep === 'wait_clone') return 3000;
      return false;
    },
  });
}

export async function fetchSetupStatus(): Promise<SetupStatus> {
  return api<SetupStatus>('/setup/status');
}
