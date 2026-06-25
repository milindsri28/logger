'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { GitHubCard } from '@/components/integrations/GitHubCard';
import { GitHubRepoPicker } from '@/components/integrations/GitHubRepoPicker';
import { InfrastructureCard } from '@/components/integrations/InfrastructureCard';
import { useIntegrationsStatus } from '@/hooks/useIntegrationsStatus';
import { api, setToken } from '@/lib/api';
import { AlertTriangle } from 'lucide-react';

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <AuthGuard>
          <AppShell>
            <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
              Loading…
            </div>
          </AppShell>
        </AuthGuard>
      }
    >
      <IntegrationsContent />
    </Suspense>
  );
}

function IntegrationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, refetch, isLoading } = useIntegrationsStatus();
  const [disconnecting, setDisconnecting] = useState(false);
  const [removingAgentId, setRemovingAgentId] = useState<string | null>(null);
  const [banner, setBanner] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setToken(token);
      router.replace('/integrations');
      refetch();
      setBanner('GitHub connected. Choose which repositories to add below.');
      return;
    }
    const github = searchParams.get('github');
    if (github === 'connected') {
      setBanner('GitHub connected. Choose which repositories to add below.');
      router.replace('/integrations');
      refetch();
    } else if (github === 'error') {
      setBanner('GitHub connection failed. Please try again.');
      router.replace('/integrations');
    }
  }, [searchParams, router, refetch]);

  async function handleRemoveAgent(agentId: string) {
    setRemovingAgentId(agentId);
    try {
      await api(`/agents/${agentId}`, { method: 'DELETE' });
      await refetch();
      setBanner('Agent removed.');
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Failed to remove agent');
    } finally {
      setRemovingAgentId(null);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await api('/integrations/repositories/github', { method: 'DELETE' });
      await refetch();
      setBanner('GitHub disconnected.');
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Disconnect failed');
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <AuthGuard>
      <AppShell>
        <div className="mx-auto max-w-4xl space-y-6 p-6">
          <div>
            <h1 className="text-xl font-semibold">Integrations</h1>
            <p className="text-[13px] text-muted-foreground">
              Connect GitHub and install infrastructure agents.
            </p>
          </div>

          {banner && (
            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-[13px]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {banner}
            </div>
          )}

          {isLoading || !data ? (
            <p className="text-[13px] text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <GitHubCard
                  status={data.github}
                  onDisconnect={handleDisconnect}
                  disconnecting={disconnecting}
                />
                <InfrastructureCard
                  agents={data.infrastructure.agents}
                  onRefresh={() => refetch()}
                  onRemove={handleRemoveAgent}
                  removingId={removingAgentId}
                />
              </div>
              {data.github.connected && (
                <GitHubRepoPicker
                  enabled={data.github.connected}
                  onConnected={() => setBanner('Repositories queued for cloning.')}
                />
              )}
            </>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
