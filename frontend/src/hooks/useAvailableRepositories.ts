import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AvailableGitHubRepo {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  htmlUrl: string;
  private: boolean;
  defaultBranch: string;
  connected: boolean;
}

export function useAvailableRepositories(enabled: boolean) {
  return useQuery({
    queryKey: ['github-available-repositories'],
    queryFn: () =>
      api<{ repositories: AvailableGitHubRepo[] }>('/github/available-repositories'),
    enabled,
    staleTime: 60_000,
  });
}
