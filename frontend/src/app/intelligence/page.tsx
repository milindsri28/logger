'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { SelectField } from '@/components/layout/PanelHeader';
import { RepositoryIntelligencePanel } from '@/components/intelligence/RepositoryIntelligencePanel';
import { BranchSelector } from '@/components/workspace/BranchSelector';
import { Button } from '@/components/ui/button';
import { useRepoBranches, useCheckoutBranch } from '@/hooks/useBranches';
import { useRepositories, useVpsConnections } from '@/hooks/useRepository';
import { useSetupStatus } from '@/hooks/useSetupStatus';

export default function IntelligencePage() {
  const { data: setup } = useSetupStatus();
  const [repositoryId, setRepositoryId] = useState<string | null>(null);

  const { data: reposData } = useRepositories();
  const { data: vpsData } = useVpsConnections();
  const repos = reposData?.repositories?.filter((r) => r.cloneStatus === 'ready') ?? [];
  const vpsList = vpsData?.connections ?? [];

  const { data: branchData, isLoading: branchesLoading, isError: branchesError, error: branchesQueryError } =
    useRepoBranches(repositoryId);
  const checkoutBranch = useCheckoutBranch(repositoryId);
  const branchLoadError = branchesError
    ? branchesQueryError instanceof Error
      ? branchesQueryError.message
      : 'Failed to load branches'
    : null;
  const branchSwitchError =
    checkoutBranch.isError && checkoutBranch.error instanceof Error ? checkoutBranch.error.message : null;

  const activeRepo = repos.find((r) => r.id === repositoryId);
  const activeVps = vpsList[0];
  const currentBranch = branchData?.currentBranch ?? null;

  useEffect(() => {
    if (!repositoryId && repos[0]) setRepositoryId(repos[0].id);
  }, [repos, repositoryId]);

  async function handleBranchChange(branch: string) {
    if (!repositoryId || branch === currentBranch) return;
    checkoutBranch.reset();
    try {
      await checkoutBranch.mutateAsync(branch);
    } catch {
      // shown in BranchSelector
    }
  }

  const toolbar = (
    <div className="flex w-full flex-wrap items-center gap-2">
      {repos.length === 0 ? (
        <Link href="/integrations">
          <Button variant="outline" size="sm" className="h-8 text-[12px]">
            Connect repository
          </Button>
        </Link>
      ) : (
        <>
          <SelectField
            value={repositoryId || ''}
            onChange={(v) => setRepositoryId(v || null)}
            placeholder="Repository"
            className="h-8 min-w-[160px] text-[12px]"
            options={repos.map((r) => ({ value: r.id, label: `${r.owner}/${r.name}` }))}
          />
          {repositoryId && (
            <BranchSelector
              branches={branchData?.branches}
              currentBranch={currentBranch ?? undefined}
              isLoading={branchesLoading}
              isSwitching={checkoutBranch.isPending}
              loadError={branchLoadError}
              switchError={branchSwitchError}
              onBranchChange={handleBranchChange}
            />
          )}
        </>
      )}
      {activeRepo && currentBranch && (
        <span className="text-[11px] text-muted-foreground">
          Analysis scoped to{' '}
          <span className="font-mono-code text-primary/80">{currentBranch}</span>
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
        <div className="h-full min-h-0">
          {!repositoryId || !currentBranch ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Connect a repository to run intelligence analysis
            </div>
          ) : (
            <RepositoryIntelligencePanel
              repositoryId={repositoryId}
              branch={currentBranch}
              repoOwner={activeRepo?.owner}
              repoName={activeRepo?.name}
            />
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
