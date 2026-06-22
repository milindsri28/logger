'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { VpsService } from '@/types';
import { Box, Container, Server } from 'lucide-react';

interface ServiceCardProps {
  service: VpsService;
  selected: boolean;
  onClick: () => void;
}

const statusVariant = {
  running: 'success' as const,
  down: 'danger' as const,
  warning: 'warning' as const,
};

const typeIcon = {
  pm2: Server,
  docker: Container,
  system: Box,
};

export function ServiceCard({ service, selected, onClick }: ServiceCardProps) {
  const Icon = typeIcon[service.type] || Server;
  const displayName = service.name
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-border/60 bg-[#252526] p-3 text-left transition-all hover:border-primary/40 hover:bg-[#2a2d2e]',
        selected && 'border-primary/60 bg-primary/10 ring-1 ring-primary/30'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{displayName}</span>
        </div>
        <Badge variant={statusVariant[service.status]}>{service.status}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{service.type} · {service.name}</p>
    </button>
  );
}
