import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  ApiEndpoint,
  HotFile,
  ProjectInfo,
  RepositoryStats,
  ScanCommit,
  ScanStatus,
} from '@/types';

function branchKey(repositoryId: string | null, branch: string | null) {
  return ['repository-intelligence', repositoryId, branch] as const;
}

function qs(repositoryId: string, branch?: string | null) {
  const params = new URLSearchParams({ repositoryId });
  if (branch) params.set('branch', branch);
  return params.toString();
}

export function useScanStatus(repositoryId: string | null, branch: string | null) {
  return useQuery({
    queryKey: [...branchKey(repositoryId, branch), 'status'],
    queryFn: () => api<ScanStatus>(`/repository/status?${qs(repositoryId!, branch || undefined)}`),
    enabled: !!repositoryId,
    staleTime: 30_000,
  });
}

export function useAnalyzeRepository(repositoryId: string | null, branch: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api<{ message: string; branch: string; status: string; scannedAt: string }>('/repository/analyze', {
        method: 'POST',
        body: JSON.stringify({ repositoryId, branch: branch || undefined }),
      }),
    onSuccess: () => {
      if (repositoryId) {
        queryClient.invalidateQueries({ queryKey: branchKey(repositoryId, branch) });
      }
    },
  });
}

export function useProjectInfo(repositoryId: string | null, branch: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...branchKey(repositoryId, branch), 'project-info'],
    queryFn: () =>
      api<{ branch: string; projectInfo: ProjectInfo; scannedAt: string | null }>(
        `/repository/project-info?${qs(repositoryId!, branch || undefined)}`
      ),
    enabled: !!repositoryId && enabled,
    staleTime: 60_000,
  });
}

export function useRepositoryStats(repositoryId: string | null, branch: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...branchKey(repositoryId, branch), 'stats'],
    queryFn: () =>
      api<{ branch: string; stats: RepositoryStats; scannedAt: string | null }>(
        `/repository/stats?${qs(repositoryId!, branch || undefined)}`
      ),
    enabled: !!repositoryId && enabled,
    staleTime: 60_000,
  });
}

export function useApiInventory(repositoryId: string | null, branch: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...branchKey(repositoryId, branch), 'apis'],
    queryFn: () =>
      api<{ branch: string; apis: ApiEndpoint[] }>(`/repository/apis?${qs(repositoryId!, branch || undefined)}`),
    enabled: !!repositoryId && enabled,
    staleTime: 60_000,
  });
}

export function useDetectedServices(repositoryId: string | null, branch: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...branchKey(repositoryId, branch), 'services'],
    queryFn: () =>
      api<{ branch: string; services: string[] }>(`/repository/services?${qs(repositoryId!, branch || undefined)}`),
    enabled: !!repositoryId && enabled,
    staleTime: 60_000,
  });
}

export function useDetectedDatabases(repositoryId: string | null, branch: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...branchKey(repositoryId, branch), 'databases'],
    queryFn: () =>
      api<{ branch: string; databases: string[] }>(`/repository/databases?${qs(repositoryId!, branch || undefined)}`),
    enabled: !!repositoryId && enabled,
    staleTime: 60_000,
  });
}

export function useDetectedIntegrations(repositoryId: string | null, branch: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...branchKey(repositoryId, branch), 'integrations'],
    queryFn: () =>
      api<{ branch: string; integrations: string[] }>(
        `/repository/integrations?${qs(repositoryId!, branch || undefined)}`
      ),
    enabled: !!repositoryId && enabled,
    staleTime: 60_000,
  });
}

export function useEnvVars(repositoryId: string | null, branch: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...branchKey(repositoryId, branch), 'env-vars'],
    queryFn: () =>
      api<{ branch: string; envVars: string[] }>(`/repository/env-vars?${qs(repositoryId!, branch || undefined)}`),
    enabled: !!repositoryId && enabled,
    staleTime: 60_000,
  });
}

export function useScanCommits(repositoryId: string | null, branch: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...branchKey(repositoryId, branch), 'commits'],
    queryFn: () =>
      api<{ branch: string; commits: ScanCommit[] }>(`/repository/commits?${qs(repositoryId!, branch || undefined)}`),
    enabled: !!repositoryId && enabled,
    staleTime: 60_000,
  });
}

export function useHotFiles(repositoryId: string | null, branch: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...branchKey(repositoryId, branch), 'hot-files'],
    queryFn: () =>
      api<{ branch: string; hotFiles: HotFile[] }>(`/repository/hot-files?${qs(repositoryId!, branch || undefined)}`),
    enabled: !!repositoryId && enabled,
    staleTime: 60_000,
  });
}
