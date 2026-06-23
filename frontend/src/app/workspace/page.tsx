'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Group, Panel, usePanelRef } from 'react-resizable-panels';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { WorkspaceTopBar } from '@/components/layout/WorkspaceTopBar';
import { ResizeHandle } from '@/components/layout/ResizeHandle';
import { PanelCollapseButton } from '@/components/layout/PanelCollapseButton';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { LogExplorer } from '@/components/logs/LogExplorer';
import { RepositoryContext } from '@/components/workspace/RepositoryContext';
import { FileViewerSheet } from '@/components/workspace/FileViewerSheet';
import { BranchSelector } from '@/components/workspace/BranchSelector';
import { useRepoFile, useRepositories, useVpsConnections } from '@/hooks/useRepository';
import { useVpsServices, useVpsLogs } from '@/hooks/useVps';
import { useWorkspaceServices } from '@/hooks/useWorkspaceServices';
import { useRecentCommits, useRelevantFiles } from '@/hooks/useGithubContext';
import { useLatestInvestigation, fetchIncidentReport } from '@/hooks/useInvestigation';
import { useRepoBranches, useCheckoutBranch } from '@/hooks/useBranches';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import { useAnalyzeMutation, pollIncidentStatus, progressLabel } from '@/hooks/useAnalyze';
import { Badge } from '@/components/ui/badge';
import type { InvestigationReport } from '@/types';

const RESIZE_HIT = { coarse: 48, fine: 24 };

export default function WorkspacePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const chatPanelRef = usePanelRef();
  const contextPanelRef = usePanelRef();
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [contextCollapsed, setContextCollapsed] = useState(false);

  const { data: setup, isLoading: setupLoading } = useSetupStatus();
  const analyzeMutation = useAnalyzeMutation();
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState('');
  const [analyzeError, setAnalyzeError] = useState('');
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  const [investigationReport, setInvestigationReport] = useState<InvestigationReport | null>(null);

  const [repositoryId, setRepositoryId] = useState<string | null>(null);
  const [vpsConnectionId, setVpsConnectionId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [viewerFile, setViewerFile] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: reposData } = useRepositories();
  const { data: vpsData } = useVpsConnections();
  const repos = reposData?.repositories?.filter((r) => r.cloneStatus === 'ready') ?? [];
  const vpsList = vpsData?.connections ?? [];

  const { data: branchData, isLoading: branchesLoading, isError: branchesError, error: branchesQueryError } = useRepoBranches(repositoryId);
  const checkoutBranch = useCheckoutBranch(repositoryId);
  const branchLoadError = branchesError ? (branchesQueryError instanceof Error ? branchesQueryError.message : 'Failed to load branches') : null;
  const branchSwitchError = checkoutBranch.isError && checkoutBranch.error instanceof Error ? checkoutBranch.error.message : null;

  useEffect(() => {
    if (!setupLoading && setup && !setup.canUseWorkspace) {
      router.replace('/onboarding');
    }
  }, [setup, setupLoading, router]);

  useEffect(() => {
    if (!repositoryId && repos[0]) setRepositoryId(repos[0].id);
  }, [repos, repositoryId]);

  useEffect(() => {
    if (!vpsConnectionId && vpsList[0]) setVpsConnectionId(vpsList[0].id);
  }, [vpsList, vpsConnectionId]);

  const { data: services, isLoading: servicesLoading, isError: servicesError } = useVpsServices(vpsConnectionId);
  const { pinnedServices, availableToAdd, addService, removeService } = useWorkspaceServices(
    vpsConnectionId,
    services
  );

  useEffect(() => {
    if (!selectedService && pinnedServices.length) setSelectedService(pinnedServices[0].name);
  }, [pinnedServices, selectedService]);

  useEffect(() => {
    if (!selectedService) return;
    if (!pinnedServices.some((s) => s.name === selectedService)) {
      setSelectedService(pinnedServices[0]?.name ?? null);
      setInvestigationReport(null);
      setActiveIncidentId(null);
    }
  }, [pinnedServices, selectedService]);

  const activeRepo = repos.find((r) => r.id === repositoryId);
  const activeVps = vpsList.find((v) => v.id === vpsConnectionId);
  const activeService = pinnedServices.find((s) => s.name === selectedService);

  const { data: file, isLoading: fileLoading } = useRepoFile(repositoryId, viewerFile);
  const { data: commitsData, isLoading: commitsLoading } = useRecentCommits(repositoryId, branchData?.currentBranch);
  const { data: filesData, isLoading: filesLoading } = useRelevantFiles(repositoryId, branchData?.currentBranch);
  const { data: latestInvestigation } = useLatestInvestigation(selectedService);

  useEffect(() => {
    if (latestInvestigation?.report && !investigationReport && !analyzing) {
      setInvestigationReport(latestInvestigation.report);
      if (latestInvestigation.incident) setActiveIncidentId(latestInvestigation.incident.id);
    }
  }, [latestInvestigation, investigationReport, analyzing]);

  const {
    data: logsData,
    isLoading: logsLoading,
    isError: logsError,
    refetch: refetchLogs,
  } = useVpsLogs(vpsConnectionId, selectedService, autoRefresh || liveMode, 500);

  async function handleBranchChange(branch: string) {
    if (!repositoryId || branch === branchData?.currentBranch) return;
    checkoutBranch.reset();
    try {
      await checkoutBranch.mutateAsync(branch);
    } catch {
      // error shown via branchSwitchError
    }
  }

  function toggleChatPanel() {
    const panel = chatPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setChatCollapsed(false);
    } else {
      panel.collapse();
      setChatCollapsed(true);
    }
  }

  function toggleContextPanel() {
    const panel = contextPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setContextCollapsed(false);
    } else {
      panel.collapse();
      setContextCollapsed(true);
    }
  }

  async function handleAnalyze() {
    if (!repositoryId || !vpsConnectionId || !selectedService) return;
    setAnalyzing(true);
    setAnalyzeStep('Starting…');
    setAnalyzeError('');
    setInvestigationReport(null);
    try {
      const result = await analyzeMutation.mutateAsync({
        repositoryId,
        vpsConnectionId,
        serviceName: selectedService,
        selectedFile,
      });
      const incidentId = result.incident.id;
      setActiveIncidentId(incidentId);

      const poll = async () => {
        const status = await pollIncidentStatus(incidentId);
        setAnalyzeStep(progressLabel(status.progressStep));
        if (status.status === 'completed') {
          const full = await fetchIncidentReport(incidentId);
          if (full.report) {
            setInvestigationReport(full.report);
          }
          queryClient.invalidateQueries({ queryKey: ['latest-investigation', selectedService] });
          setAnalyzing(false);
          setAnalyzeStep('');
          return;
        }
        if (status.status === 'failed') {
          setAnalyzing(false);
          setAnalyzeStep('');
          setAnalyzeError('Investigation failed. Check backend logs or try again.');
          return;
        }
        setTimeout(poll, 2000);
      };
      await poll();
    } catch (err) {
      setAnalyzing(false);
      setAnalyzeStep('');
      setAnalyzeError(err instanceof Error ? err.message : 'Investigation failed to start');
    }
  }

  const canAnalyze = !!repositoryId && !!vpsConnectionId && !!selectedService && !analyzing;

  const toolbar = (
    <WorkspaceTopBar
      repos={repos}
      vpsList={vpsList}
      repositoryId={repositoryId}
      vpsConnectionId={vpsConnectionId}
      branches={branchData?.branches}
      currentBranch={branchData?.currentBranch}
      branchesLoading={branchesLoading}
      branchSwitching={checkoutBranch.isPending}
      branchLoadError={branchLoadError}
      branchSwitchError={branchSwitchError}
      onRepositoryChange={(id) => {
        setRepositoryId(id);
        setSelectedFile(null);
      }}
      onBranchChange={handleBranchChange}
      onVpsChange={(id) => {
        setVpsConnectionId(id);
        setSelectedService(null);
        setInvestigationReport(null);
        setActiveIncidentId(null);
      }}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onRunInvestigation={handleAnalyze}
      canAnalyze={canAnalyze}
      analyzing={analyzing}
      analyzeStep={analyzeStep}
    />
  );

  if (setupLoading) {
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
        showServicesPanel={!!vpsConnectionId}
        services={pinnedServices}
        availableServices={availableToAdd}
        servicesLoading={servicesLoading}
        servicesError={servicesError}
        selectedService={selectedService}
        onSelectService={(name) => {
          setSelectedService(name);
          setInvestigationReport(null);
          setActiveIncidentId(null);
        }}
        onAddService={(name) => {
          addService(name);
          setSelectedService(name);
          setInvestigationReport(null);
          setActiveIncidentId(null);
        }}
        onRemoveService={removeService}
        activeRepo={activeRepo ? { owner: activeRepo.owner, name: activeRepo.name } : null}
        activeVps={activeVps ? { name: activeVps.name, host: activeVps.host } : null}
      >
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
          <div className="shrink-0 space-y-2 border-b border-border/60 bg-background px-4 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">
                  Repository:{' '}
                  <span className="font-mono-code text-foreground/80">
                    {activeRepo ? `${activeRepo.owner}/${activeRepo.name}` : '—'}
                  </span>
                  {branchData?.currentBranch && (
                    <span className="ml-2 font-mono-code text-primary/80">@ {branchData.currentBranch}</span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Logs Service:{' '}
                  <span className="font-mono-code text-foreground/80">{selectedService || '—'}</span>
                  {activeService && (
                    <Badge
                      variant={
                        activeService.status === 'running'
                          ? 'success'
                          : activeService.status === 'warning'
                            ? 'warning'
                            : 'danger'
                      }
                      className="ml-2 text-[9px] capitalize"
                    >
                      {activeService.status}
                    </Badge>
                  )}
                </p>
              </div>
              {repositoryId && (
                <BranchSelector
                  branches={branchData?.branches}
                  currentBranch={branchData?.currentBranch}
                  isLoading={branchesLoading}
                  isSwitching={checkoutBranch.isPending}
                  loadError={branchLoadError}
                  switchError={branchSwitchError}
                  onBranchChange={handleBranchChange}
                  className="md:hidden"
                />
              )}
            </div>
          </div>

          <Group
            id="workspace-main"
            orientation="horizontal"
            className="min-h-0 flex-1"
            resizeTargetMinimumSize={RESIZE_HIT}
          >
            <Panel id="center" defaultSize={72} minSize={10} className="min-h-0 min-w-0">
              <Group
                id="workspace-center"
                orientation="vertical"
                className="h-full min-h-0"
                resizeTargetMinimumSize={RESIZE_HIT}
              >
                <Panel id="logs-section" defaultSize={65} minSize={5} className="min-h-0">
                  <div className="h-full min-h-0 overflow-hidden p-2">
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
                      searchQuery={searchQuery}
                      onSearchQueryChange={setSearchQuery}
                    />
                  </div>
                </Panel>

                <ResizeHandle id="sep-logs-context" groupOrientation="vertical" />

                <Panel
                  id="context-section"
                  panelRef={contextPanelRef}
                  defaultSize={35}
                  minSize={5}
                  collapsible
                  collapsedSize={0}
                  onResize={() => setContextCollapsed(contextPanelRef.current?.isCollapsed() ?? false)}
                  className="min-h-0"
                >
                  <div className="flex h-full min-h-0 flex-col overflow-hidden">
                    <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-1.5">
                      <span className="text-[12px] font-medium text-muted-foreground">Repository context</span>
                      <PanelCollapseButton
                        direction="down"
                        collapsed={contextCollapsed}
                        onToggle={toggleContextPanel}
                        label="repository context"
                      />
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto p-3">
                      <RepositoryContext
                        files={filesData?.files}
                        commits={commitsData?.commits}
                        filesLoading={filesLoading}
                        commitsLoading={commitsLoading}
                        repoOwner={activeRepo?.owner}
                        repoName={activeRepo?.name}
                        onSelectFile={(path) => {
                          setViewerFile(path);
                          setSelectedFile(path);
                        }}
                      />
                    </div>
                  </div>
                </Panel>
              </Group>
            </Panel>

            <ResizeHandle id="sep-main-chat" groupOrientation="horizontal" />

            <Panel
              id="chat"
              panelRef={chatPanelRef}
              defaultSize={28}
              minSize={5}
              collapsible
              collapsedSize={0}
              onResize={() => setChatCollapsed(chatPanelRef.current?.isCollapsed() ?? false)}
              className="min-h-0 min-w-0"
            >
              <div className="h-full min-h-0 min-w-0 overflow-hidden">
                <ChatPanel
                  repositoryId={repositoryId}
                  vpsConnectionId={vpsConnectionId}
                  selectedFile={selectedFile}
                  selectedService={selectedService}
                  investigationReport={investigationReport}
                  incidentId={activeIncidentId}
                  isAnalyzing={analyzing}
                  analyzeStep={analyzeStep}
                  analyzeError={analyzeError}
                  headerActions={
                    <PanelCollapseButton
                      direction="right"
                      collapsed={chatCollapsed}
                      onToggle={toggleChatPanel}
                      label="investigator"
                    />
                  }
                />
              </div>
            </Panel>
          </Group>
        </div>

        <FileViewerSheet
          path={viewerFile}
          content={file?.content}
          isLoading={fileLoading}
          onClose={() => setViewerFile(null)}
        />
      </AppShell>
    </AuthGuard>
  );
}
