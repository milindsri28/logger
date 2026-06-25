'use client';

import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface AnalyzeInput {
  repositoryId: string;
  agentId: string;
  serviceName: string;
  selectedFile?: string | null;
  title?: string;
}

interface AnalyzeResponse {
  incident: {
    id: string;
    title: string;
    status: string;
    progressStep?: string;
  };
}

export function useAnalyzeMutation() {
  return useMutation({
    mutationFn: (input: AnalyzeInput) =>
      api<AnalyzeResponse>('/incidents/analyze', {
        method: 'POST',
        body: JSON.stringify({
          ...input,
          selectedFile: input.selectedFile || undefined,
        }),
      }),
  });
}

export async function pollIncidentStatus(id: string): Promise<{ status: string; progressStep?: string }> {
  return api<{ status: string; progressStep?: string }>(`/incidents/${id}/status`);
}

const STEP_LABELS: Record<string, string> = {
  logs: 'Fetching logs',
  parse: 'Parsing errors',
  correlate: 'Matching code',
  llm: 'Running AI',
  done: 'Done',
};

export function progressLabel(step?: string | null): string {
  if (!step) return 'Starting…';
  return STEP_LABELS[step] || step;
}

export const ANALYZE_POLL_TIMEOUT_MS = 180_000;
