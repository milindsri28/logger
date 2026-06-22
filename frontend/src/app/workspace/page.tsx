'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Group, Panel } from 'react-resizable-panels';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { SelectField } from '@/components/layout/PanelHeader';
import { ResizeHandle, PanelContent } from '@/components/layout/ResizeHandle';
import { RepoPanel } from '@/components/workspace/RepoPanel';
import { LogsPanel } from '@/components/workspace/LogsPanel';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { useRepoTree, useRepoFile, useRepositories, useVpsConnections } from '@/hooks/useRepository';
import { useVpsServices, useVpsLogs } from '@/hooks/useVps';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import { useAnalyzeMutation, pollIncidentStatus, progressLabel } from '@/hooks/useAnalyze';
import { Button } from '@/components/ui/button';

const RESIZE_HIT = { coarse: 48, fine: 24 };

export default function WorkspacePage() {
  const router = useRouter();
  const { data: setup, isLoading: setupLoading } = useSetupStatus();
  const analyzeMutation = useAnalyzeMutation();
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState('');

  const [repositoryId, setRepositoryId] = useState<string | null>(null);
  const [vpsConnectionId, setVpsConnectionId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data: reposData } = useRepositories();
  const { data: vpsData } = useVpsConnections();
  const repos = reposData?.repositories?.filter((r) => r.cloneStatus === 'ready') ?? [];
  const vpsList = vpsData?.connections ?? [];

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

  useEffect(() => {
    if (!selectedService && services?.length) setSelectedService(services[0].name);
  }, [services, selectedService]);

  const activeRepo = repos.find((r) => r.id === repositoryId);
  const { data: tree, isLoading: treeLoading, isError: treeError } = useRepoTree(repositoryId);
  const { data: file, isLoading: fileLoading } = useRepoFile(repositoryId, selectedFile);
  const {
    data: logsData,
    isLoading: logsLoading,
    isError: logsError,
    refetch: refetchLogs,
  } = useVpsLogs(vpsConnectionId, selectedService, autoRefresh);

  async function handleAnalyze() {
    if (!repositoryId || !vpsConnectionId || !selectedService) return;
    setAnalyzing(true);
    setAnalyzeStep('Starting…');
    try {
      const result = await analyzeMutation.mutateAsync({
        repositoryId,
        vpsConnectionId,
        serviceName: selectedService,
        selectedFile,
      });
      const incidentId = result.incident.id;

      const poll = async () => {
        const status = await pollIncidentStatus(incidentId);
        setAnalyzeStep(progressLabel(status.progressStep));
        if (status.status === 'completed') {
          router.push(`/incidents/${incidentId}`);
          return;
        }
        if (status.status === 'failed') {
          setAnalyzing(false);
          setAnalyzeStep('');
          return;
        }
        setTimeout(poll, 2000);
      };
      await poll();
    } catch {
      setAnalyzing(false);
      setAnalyzeStep('');
    }
  }

  const canAnalyze = !!repositoryId && !!vpsConnectionId && !!selectedService && !analyzing;

  const toolbar = (
    <>
      {repos.length === 0 ? (
        <Link href="/account?tab=github">
          <Button variant="outline" size="sm">
            No repository ready
          </Button>
        </Link>
      ) : (
        <SelectField
          value={repositoryId || ''}
          onChange={(v) => {
            setRepositoryId(v || null);
            setSelectedFile(null);
          }}
          placeholder="Repository"
          options={repos.map((r) => ({ value: r.id, label: `${r.owner}/${r.name}` }))}
        />
      )}
      {vpsList.length === 0 ? (
        <Link href="/account?tab=vps">
          <Button variant="outline" size="sm">
            No VPS connected
          </Button>
        </Link>
      ) : (
        <SelectField
          value={vpsConnectionId || ''}
          onChange={(v) => {
            setVpsConnectionId(v || null);
            setSelectedService(null);
          }}
          placeholder="VPS"
          options={vpsList.map((v) => ({ value: v.id, label: v.name }))}
        />
      )}
      <SelectField
        value={selectedService || ''}
        onChange={(v) => setSelectedService(v || null)}
        placeholder="Service"
        options={(services ?? []).map((s) => ({ value: s.name, label: s.name }))}
      />
      <Button size="sm" disabled={!canAnalyze} onClick={handleAnalyze}>
        {analyzing ? analyzeStep || 'Analyzing…' : 'Analyze'}
      </Button>
    </>
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
      <AppShell toolbar={toolbar}>
        <div className="h-full w-full">
          <Group
            id="workspace-main"
            orientation="horizontal"
            className="h-full w-full"
            resizeTargetMinimumSize={RESIZE_HIT}
          >
            <Panel id="repo" defaultSize={42} minSize={18} maxSize={65} className="min-w-0 overflow-hidden">
              <PanelContent>
                <RepoPanel
                  tree={tree}
                  treeLoading={treeLoading}
                  treeError={treeError}
                  selectedFile={selectedFile}
                  onSelectFile={setSelectedFile}
                  repoName={activeRepo ? `${activeRepo.owner}/${activeRepo.name}` : undefined}
                  fileContent={file?.content}
                  fileLoading={fileLoading}
                />
              </PanelContent>
            </Panel>

            <ResizeHandle direction="horizontal" />

            <Panel id="logs" defaultSize={33} minSize={15} maxSize={50} className="min-w-0 overflow-hidden">
              <PanelContent>
                <LogsPanel
                  services={services}
                  servicesLoading={servicesLoading}
                  servicesError={servicesError}
                  selectedService={selectedService}
                  onSelectService={setSelectedService}
                  logs={logsData?.logs}
                  logsLoading={logsLoading}
                  logsError={logsError}
                  autoRefresh={autoRefresh}
                  onAutoRefreshChange={setAutoRefresh}
                  onRefresh={() => refetchLogs()}
                />
              </PanelContent>
            </Panel>

            <ResizeHandle direction="horizontal" />

            <Panel id="chat" defaultSize={25} minSize={15} maxSize={45} className="min-w-0 overflow-hidden">
              <PanelContent>
                <ChatPanel
                  repositoryId={repositoryId}
                  vpsConnectionId={vpsConnectionId}
                  selectedFile={selectedFile}
                  selectedService={selectedService}
                />
              </PanelContent>
            </Panel>
          </Group>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
