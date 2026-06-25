'use client';

import Link from 'next/link';
import { Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIntegrationsStatus } from '@/hooks/useIntegrationsStatus';

export function EmptyInfrastructureHint() {
  const { data } = useIntegrationsStatus();
  const connectedAgents = data?.infrastructure.connectedCount ?? 0;

  if (connectedAgents > 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Server className="size-8 text-muted-foreground/50" />
        <div className="space-y-1">
          <p className="text-[13px] font-medium">Agent connected</p>
          <p className="max-w-md text-[12px] text-muted-foreground">
            Select a service in the sidebar to stream live logs, run investigations, and chat with context.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/integrations">
            <Button size="sm" variant="outline">
              Add repository
            </Button>
          </Link>
          <Link href="/integrations">
            <Button size="sm" variant="ghost">
              Manage integrations
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <Server className="size-8 text-muted-foreground/50" />
      <div className="space-y-1">
        <p className="text-[13px] font-medium">No infrastructure connected</p>
        <p className="max-w-md text-[12px] text-muted-foreground">
          Install an agent on your server to stream logs and run diagnostics.
        </p>
      </div>
      <Link href="/integrations">
        <Button size="sm">Connect infrastructure</Button>
      </Link>
    </div>
  );
}
