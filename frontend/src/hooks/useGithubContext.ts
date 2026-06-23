import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { GitCommit, RelevantFile } from '@/types';

export function useRecentCommits(repositoryId: string | null, branch?: string | null, limit = 10) {
  return useQuery({
    queryKey: ['recent-commits', repositoryId, branch, limit],
    queryFn: () =>
      api<{ commits: GitCommit[]; repository: { owner: string; name: string } }>(
        `/github/repositories/${repositoryId}/commits?limit=${limit}`
      ),
    enabled: !!repositoryId,
    staleTime: 60_000,
  });
}

export function useRelevantFiles(repositoryId: string | null, branch?: string | null, limit = 12) {
  return useQuery({
    queryKey: ['relevant-files', repositoryId, branch, limit],
    queryFn: () => api<{ files: RelevantFile[] }>(`/github/repositories/${repositoryId}/relevant-files?limit=${limit}`),
    enabled: !!repositoryId,
    staleTime: 60_000,
  });
}
