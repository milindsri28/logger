'use client';

import { Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { VpsService } from '@/types';

interface ServicePillsProps {
  services: VpsService[] | undefined;
  isLoading: boolean;
  isError: boolean;
  selectedService: string | null;
  onSelectService: (name: string) => void;
}

const statusVariant = {
  running: 'success' as const,
  down: 'danger' as const,
  warning: 'warning' as const,
};

export function ServicePills({
  services,
  isLoading,
  isError,
  selectedService,
  onSelectService,
}: ServicePillsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <Activity className="size-3.5 shrink-0 text-muted-foreground" />
      {isLoading &&
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-7 w-24 shrink-0 rounded-full" />)}
      {isError && <span className="text-[11px] text-destructive">Could not load services</span>}
      {!isLoading &&
        !isError &&
        services?.map((svc) => (
          <button
            key={svc.name}
            type="button"
            onClick={() => onSelectService(svc.name)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium transition-all',
              selectedService === svc.name
                ? 'border-primary/50 bg-primary/15 text-primary shadow-sm shadow-primary/10'
                : 'border-border/60 bg-secondary/40 text-muted-foreground hover:border-primary/30 hover:text-foreground'
            )}
          >
            <span
              className={cn(
                'size-1.5 rounded-full',
                svc.status === 'running' && 'bg-emerald-400',
                svc.status === 'warning' && 'bg-amber-400',
                svc.status === 'down' && 'bg-red-400'
              )}
            />
            {svc.name}
            <Badge variant={statusVariant[svc.status]} className="px-1 py-0 text-[9px] capitalize">
              {svc.status}
            </Badge>
          </button>
        ))}
    </div>
  );
}
