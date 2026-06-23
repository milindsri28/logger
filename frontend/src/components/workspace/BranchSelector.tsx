'use client';

import { GitBranch, Loader2 } from 'lucide-react';
import { SelectField } from '@/components/layout/PanelHeader';
import { cn } from '@/lib/utils';
import type { RepoBranch } from '@/hooks/useBranches';

interface BranchSelectorProps {
  branches: RepoBranch[] | undefined;
  currentBranch: string | undefined;
  isLoading: boolean;
  isSwitching: boolean;
  loadError?: string | null;
  switchError?: string | null;
  disabled?: boolean;
  onBranchChange: (branch: string) => void;
  className?: string;
}

export function BranchSelector({
  branches,
  currentBranch,
  isLoading,
  isSwitching,
  loadError,
  switchError,
  disabled,
  onBranchChange,
  className,
}: BranchSelectorProps) {
  if (isLoading) {
    return (
      <div className={cn('flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] text-muted-foreground', className)}>
        <Loader2 className="size-3 animate-spin" />
        Branches…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={cn('max-w-[200px] truncate text-[11px] text-destructive', className)} title={loadError}>
        Branch load failed
      </div>
    );
  }

  if (!branches?.length) return null;

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <div className="flex items-center gap-1.5">
        <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
        <SelectField
          value={currentBranch || branches[0]?.name || ''}
          onChange={(v) => v && onBranchChange(v)}
          placeholder="Branch"
          className="h-8 min-w-[110px] text-[12px]"
          disabled={disabled || isSwitching}
          options={branches.map((b) => ({
            value: b.name,
            label: b.isDefault ? `${b.name} (default)` : b.name,
          }))}
        />
        {isSwitching && <Loader2 className="size-3.5 animate-spin text-primary" />}
      </div>
      {switchError && (
        <p className="max-w-[220px] truncate text-[10px] text-destructive" title={switchError}>
          {switchError}
        </p>
      )}
    </div>
  );
}
