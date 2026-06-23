import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface RepoBranch {
  name: string;
  isDefault: boolean;
}

export function useRepoBranches(repositoryId: string | null) {
  return useQuery({
    queryKey: ['repo-branches', repositoryId],
    queryFn: () =>
      api<{
        branches: RepoBranch[];
        currentBranch: string;
        defaultBranch: string;
      }>(`/github/repositories/${repositoryId}/branches`),
    enabled: !!repositoryId,
    staleTime: 30_000,
  });
}

export function useCheckoutBranch(repositoryId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branch: string) =>
      api<{ branch: string; indexStatus: string }>(`/github/repositories/${repositoryId}/checkout`, {
        method: 'POST',
        body: JSON.stringify({ branch }),
      }),
    onSuccess: (_data, branch) => {
      queryClient.invalidateQueries({ queryKey: ['repo-branches', repositoryId] });
      queryClient.invalidateQueries({ queryKey: ['repo-tree', repositoryId] });
      queryClient.invalidateQueries({ queryKey: ['repo-file'] });
      queryClient.invalidateQueries({ queryKey: ['recent-commits', repositoryId] });
      queryClient.invalidateQueries({ queryKey: ['relevant-files', repositoryId] });
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      // Prime branch-scoped context queries for the new branch
      queryClient.invalidateQueries({ queryKey: ['recent-commits', repositoryId, branch] });
      queryClient.invalidateQueries({ queryKey: ['relevant-files', repositoryId, branch] });
    },
  });
}
