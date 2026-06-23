'use client';

import { Terminal } from 'lucide-react';
import { ServiceList } from '@/components/services/ServiceList';
import { LogViewer } from '@/components/logs/LogViewer';
import { PanelHeader } from '@/components/layout/PanelHeader';
import type { VpsService } from '@/types';

interface LogsPanelProps {
  services: VpsService[] | undefined;
  servicesLoading: boolean;
  servicesError: boolean;
  selectedService: string | null;
  onSelectService: (name: string) => void;
  logs: string | undefined;
  logsLoading: boolean;
  logsError: boolean;
  autoRefresh: boolean;
  onAutoRefreshChange: (v: boolean) => void;
  onRefresh: () => void;
}

export function LogsPanel(props: LogsPanelProps) {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-card">
      <PanelHeader
        icon={Terminal}
        title="Logs"
        subtitle={props.selectedService ? `Service: ${props.selectedService}` : 'Select a service below'}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="max-h-[180px] shrink-0 overflow-hidden border-b border-border/40">
          <ServiceList
            services={props.services}
            isLoading={props.servicesLoading}
            isError={props.servicesError}
            selectedService={props.selectedService}
            onSelectService={props.onSelectService}
            compact
          />
        </div>
        <div className="min-h-0 flex-1">
          <LogViewer
            logs={props.logs}
            isLoading={props.logsLoading}
            isError={props.logsError}
            serviceName={props.selectedService}
            autoRefresh={props.autoRefresh}
            onAutoRefreshChange={props.onAutoRefreshChange}
            onRefresh={props.onRefresh}
            hideHeader
          />
        </div>
      </div>
    </div>
  );
}
