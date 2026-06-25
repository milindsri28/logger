'use client';

import Link from 'next/link';
import { Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectField } from '@/components/layout/PanelHeader';
import { BranchSelector } from '@/components/workspace/BranchSelector';
import type { RepoBranch } from '@/hooks/useBranches';

interface WorkspaceTopBarProps {
  repos: Array<{ id: string; owner: string; name: string }>;
  vpsList: Array<{ id: string; name: string }>;
  agents: Array<{ id: string; hostname: string; status: string }>;
  repositoryId: string | null;
  vpsConnectionId: string | null;
  agentId: string | null;
  branches: RepoBranch[] | undefined;
  currentBranch: string | undefined;
  branchesLoading: boolean;
  branchSwitching: boolean;
  branchLoadError?: string | null;
  branchSwitchError?: string | null;
  onRepositoryChange: (id: string | null) => void;
  onBranchChange: (branch: string) => void;
  onVpsChange: (id: string | null) => void;
  onAgentChange: (id: string | null) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRunInvestigation: () => void;
  canAnalyze: boolean;
  analyzing: boolean;
  analyzeStep?: string;
}

export function WorkspaceTopBar({
  repos,
  vpsList,
  agents,
  repositoryId,
  vpsConnectionId,
  agentId,
  branches,
  currentBranch,
  branchesLoading,
  branchSwitching,
  branchLoadError,
  branchSwitchError,
  onRepositoryChange,
  onBranchChange,
  onVpsChange,
  onAgentChange,
  searchQuery,
  onSearchChange,
  onRunInvestigation,
  canAnalyze,
  analyzing,
  analyzeStep,
}: WorkspaceTopBarProps) {
  const connectedAgents = agents.filter((a) => a.status === 'connected');
  const infraOptions = [
    ...vpsList.map((v) => ({ value: `vps:${v.id}`, label: v.name })),
    ...connectedAgents.map((a) => ({ value: `agent:${a.id}`, label: a.hostname })),
  ];
  const infraValue = vpsConnectionId
    ? `vps:${vpsConnectionId}`
    : agentId
      ? `agent:${agentId}`
      : '';

  return (
    <div className="flex w-full items-center gap-3">
      <div className="flex flex-wrap items-center gap-2">
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
              onChange={(v) => onRepositoryChange(v || null)}
              placeholder="Repository"
              className="h-8 min-w-[140px] text-[12px]"
              options={repos.map((r) => ({ value: r.id, label: `${r.owner}/${r.name}` }))}
            />
            {repositoryId && (
              <BranchSelector
                branches={branches}
                currentBranch={currentBranch}
                isLoading={branchesLoading}
                isSwitching={branchSwitching}
                loadError={branchLoadError}
                switchError={branchSwitchError}
                onBranchChange={onBranchChange}
              />
            )}
          </>
        )}

        {infraOptions.length === 0 ? (
          <Link href="/integrations">
            <Button variant="outline" size="sm" className="h-8 text-[12px]">
              Connect server
            </Button>
          </Link>
        ) : (
          <SelectField
            value={infraValue}
            onChange={(v) => {
              if (!v) {
                onVpsChange(null);
                onAgentChange(null);
                return;
              }
              if (v.startsWith('vps:')) {
                onAgentChange(null);
                onVpsChange(v.slice(4) || null);
                return;
              }
              if (v.startsWith('agent:')) {
                onVpsChange(null);
                onAgentChange(v.slice(6) || null);
              }
            }}
            placeholder="Environment"
            className="h-8 min-w-[130px]"
            options={infraOptions}
          />
        )}

      </div>

      <div className="relative hidden min-w-[180px] flex-1 max-w-xs md:block">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search logs, files…"
          className="h-8 border-border/60 bg-background pl-8 text-[12px]"
        />
      </div>

      <div className="ml-auto">
        <Button
          size="sm"
          disabled={!canAnalyze}
          onClick={onRunInvestigation}
          className="h-8 gap-1.5 bg-primary px-4 text-[12px] shadow-lg shadow-primary/20"
        >
          <Sparkles className="size-3.5" />
          {analyzing ? analyzeStep || 'Analyzing…' : 'Run Investigation'}
        </Button>
      </div>
    </div>
  );
}
