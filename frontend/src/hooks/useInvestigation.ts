import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { InvestigationReport } from '@/types';

export function useLatestInvestigation(serviceName: string | null) {
  return useQuery({
    queryKey: ['latest-investigation', serviceName],
    queryFn: () =>
      api<{
        incident: { id: string; title: string; status: string } | null;
        report: InvestigationReport | null;
      }>(`/incidents/latest?serviceName=${encodeURIComponent(serviceName!)}`),
    enabled: !!serviceName,
    staleTime: 30_000,
  });
}

export async function fetchIncidentReport(id: string) {
  return api<{
    incident: { id: string; status: string; extractedSignals?: { errors: string[] } };
    report: InvestigationReport | null;
  }>(`/incidents/${id}`);
}
