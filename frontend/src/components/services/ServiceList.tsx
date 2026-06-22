'use client';

import { Activity, AlertCircle } from 'lucide-react';
import { ServiceCard } from './ServiceCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { VpsService } from '@/types';

interface ServiceListProps {
  services: VpsService[] | undefined;
  isLoading: boolean;
  isError: boolean;
  selectedService: string | null;
  onSelectService: (name: string) => void;
  compact?: boolean;
}

const statusVariant = {
  running: 'success' as const,
  down: 'danger' as const,
  warning: 'warning' as const,
};

export function ServiceList({
  services,
  isLoading,
  isError,
  selectedService,
  onSelectService,
  compact,
}: ServiceListProps) {
  if (compact) {
    return (
      <div className="flex h-full flex-col bg-[#1e1e1e]">
        <div className="flex shrink-0 items-center gap-2 border-b border-border/40 px-3 py-1.5">
          <Activity className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Services</span>
        </div>
        <div className="flex gap-2 overflow-x-auto p-2">
          {isLoading && Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-md" />
          ))}
          {isError && (
            <span className="text-xs text-destructive">VPS not connected — go to Account</span>
          )}
          {!isLoading && !isError && services?.map((svc) => (
            <button
              key={svc.name}
              type="button"
              onClick={() => onSelectService(svc.name)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors',
                selectedService === svc.name
                  ? 'border-primary/50 bg-primary/15 text-primary'
                  : 'border-border/60 bg-[#252526] hover:border-primary/30'
              )}
            >
              {svc.name}
              <Badge variant={statusVariant[svc.status]} className="text-[10px]">
                {svc.status}
              </Badge>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2">
        <Activity className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Running Services</h3>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {isLoading && (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg bg-[#2d2d2d]" />
            ))}
          </div>
        )}
        {isError && (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <AlertCircle className="size-8 text-destructive/70" />
            <p className="text-sm">Could not load VPS services</p>
            <p className="text-xs">Connect VPS in Account settings</p>
          </div>
        )}
        {!isLoading && !isError && services?.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No services detected on VPS</p>
        )}
        {!isLoading && !isError && services && services.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {services.map((svc) => (
              <ServiceCard
                key={svc.name}
                service={svc}
                selected={selectedService === svc.name}
                onClick={() => onSelectService(svc.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
