'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Group, Panel } from 'react-resizable-panels';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { SelectField } from '@/components/layout/PanelHeader';
import { ResizeHandle, PanelContent } from '@/components/layout/ResizeHandle';
import { LogExplorer } from '@/components/logs/LogExplorer';
import { LoggerServiceSidebar } from '@/components/logs/LoggerServiceSidebar';
import { Button } from '@/components/ui/button';
import { useRepositories, useVpsConnections } from '@/hooks/useRepository';
import { useVpsServices, useVpsLogs } from '@/hooks/useVps';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import { EmptyInfrastructureHint } from '@/components/setup/EmptyInfrastructureHint';

const RESIZE_HIT = { coarse: 48, fine: 24 };

export default function LoggerPage() {
  const { data: setup } = useSetupStatus();
  const [vpsConnectionId, setVpsConnectionId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [liveMode, setLiveMode] = useState(false);

  const { data: reposData } = useRepositories();
  const { data: vpsData } = useVpsConnections();
  const repos = reposData?.repositories?.filter((r) => r.cloneStatus === 'ready') ?? [];
  const vpsList = vpsData?.connections ?? [];
  const activeRepo = repos[0];
  const activeVps = vpsList.find((v) => v.id === vpsConnectionId);

  useEffect(() => {
    if (!vpsConnectionId && vpsList[0]) setVpsConnectionId(vpsList[0].id);
  }, [vpsList, vpsConnectionId]);

  const { data: services, isLoading: servicesLoading, isError: servicesError } = useVpsServices(vpsConnectionId);

  useEffect(() => {
    if (!selectedService && services?.length) setSelectedService(services[0].name);
  }, [services, selectedService]);

  useEffect(() => {
    if (selectedService && services && !services.some((s) => s.name === selectedService)) {
      setSelectedService(services[0]?.name ?? null);
    }
  }, [services, selectedService]);

  const {
    data: logsData,
    isLoading: logsLoading,
    isError: logsError,
    refetch: refetchLogs,
  } = useVpsLogs(vpsConnectionId, selectedService, autoRefresh || liveMode, 500);

  const toolbar = (
    <div className="flex w-full flex-wrap items-center gap-2">
      {vpsList.length === 0 ? (
        <Link href="/integrations">
          <Button variant="outline" size="sm" className="h-8 text-[12px]">
            Connect infrastructure
          </Button>
        </Link>
      ) : (
        <SelectField
          value={vpsConnectionId || ''}
          onChange={(v) => {
            setVpsConnectionId(v || null);
            setSelectedService(null);
          }}
          placeholder="Environment"
          className="h-8 min-w-[140px] text-[12px]"
          options={vpsList.map((v) => ({ value: v.id, label: v.name }))}
        />
      )}
      {selectedService && (
        <span className="text-[11px] text-muted-foreground">
          Viewing logs for{' '}
          <span className="font-mono-code text-foreground/80">{selectedService}</span>
        </span>
      )}
    </div>
  );

  if (!setup) {
    return (
      <AuthGuard>
        <AppShell>
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
        </AppShell>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <AppShell
        toolbar={toolbar}
        activeRepo={activeRepo ? { owner: activeRepo.owner, name: activeRepo.name } : null}
        activeVps={activeVps ? { name: activeVps.name, host: activeVps.host } : null}
      >
        <div className="h-full min-h-0 p-2">
          {!vpsConnectionId ? (
            <EmptyInfrastructureHint />
          ) : (
            <Group
              id="logger-main"
              orientation="horizontal"
              className="h-full min-h-0"
              resizeTargetMinimumSize={RESIZE_HIT}
            >
              <Panel id="logger-services" defaultSize={22} minSize={14} maxSize={40} className="min-h-0 min-w-0">
                <PanelContent>
                  <LoggerServiceSidebar
                    services={services}
                    isLoading={servicesLoading}
                    isError={servicesError}
                    selectedService={selectedService}
                    onSelectService={setSelectedService}
                  />
                </PanelContent>
              </Panel>

              <ResizeHandle id="sep-logger-services-logs" groupOrientation="horizontal" />

              <Panel id="logger-logs" defaultSize={78} minSize={45} className="min-h-0 min-w-0">
                <PanelContent>
                  <LogExplorer
                  logs={logsData?.logs}
                  isLoading={logsLoading}
                  isError={logsError}
                  serviceName={selectedService}
                  vpsConnectionId={vpsConnectionId}
                  autoRefresh={autoRefresh}
                  liveMode={liveMode}
                  onAutoRefreshChange={setAutoRefresh}
                  onLiveModeChange={setLiveMode}
                    onRefresh={() => refetchLogs()}
                  />
                </PanelContent>
              </Panel>
            </Group>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
