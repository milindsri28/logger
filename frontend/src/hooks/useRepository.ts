import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TreeNode } from '@/types';

export function useRepoTree(repositoryId: string | null) {
  return useQuery({
    queryKey: ['repo-tree', repositoryId],
    queryFn: () => api<TreeNode>(`/repo/tree?repositoryId=${repositoryId}`),
    enabled: !!repositoryId,
  });
}

export function useRepoFile(repositoryId: string | null, path: string | null) {
  return useQuery({
    queryKey: ['repo-file', repositoryId, path],
    queryFn: () =>
      api<{ path: string; content: string; language: string }>(
        `/repo/file?repositoryId=${repositoryId}&path=${encodeURIComponent(path!)}`
      ),
    enabled: !!repositoryId && !!path,
  });
}

export function useRepositories() {
  return useQuery({
    queryKey: ['repositories'],
    queryFn: () =>
      api<{ repositories: Array<{ id: string; owner: string; name: string; cloneStatus: string; indexStatus: string; failureReason?: string | null }> }>(
        '/github/repositories'
      ),
  });
}

export function useVpsConnections() {
  return useQuery({
    queryKey: ['vps-connections'],
    queryFn: () =>
      api<{ connections: Array<{ id: string; name: string; host: string; port: number; username: string }> }>(
        '/vps/connections'
      ),
  });
}
