'use client';

import { Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { VpsService } from '@/types';

interface LoggerServiceSidebarProps {
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

export function LoggerServiceSidebar({
  services,
  isLoading,
  isError,
  selectedService,
  onSelectService,
}: LoggerServiceSidebarProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-r border-border/60 bg-card/30">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2.5">
        <Activity className="size-3.5 text-primary/70" />
        <h2 className="text-[13px] font-medium">All Services</h2>
        {services && (
          <span className="ml-auto text-[10px] text-muted-foreground">{services.length}</span>
        )}
      </div>

      <div className="panel-touch-scroll h-0 min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="mb-1.5 h-10 w-full rounded-md" />
          ))}

        {isError && (
          <p className="px-2 py-4 text-center text-[11px] text-destructive">Could not load services</p>
        )}

        {!isLoading && !isError && services?.length === 0 && (
          <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">No services on server</p>
        )}

        {!isLoading &&
          !isError &&
          services?.map((svc) => (
            <button
              key={svc.name}
              type="button"
              onClick={() => onSelectService(svc.name)}
              className={cn(
                'mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
                selectedService === svc.name
                  ? 'bg-primary/12 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  svc.status === 'running' && 'bg-emerald-400',
                  svc.status === 'warning' && 'bg-amber-400',
                  svc.status === 'down' && 'bg-red-400'
                )}
              />
              <span className="min-w-0 flex-1 truncate font-mono-code text-[11px]">{svc.name}</span>
              <Badge variant={statusVariant[svc.status]} className="px-1 py-0 text-[9px] capitalize">
                {svc.status === 'running' ? 'ok' : svc.status}
              </Badge>
            </button>
          ))}
      </div>
    </div>
  );
}
