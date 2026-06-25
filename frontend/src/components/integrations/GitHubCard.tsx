'use client';

import { Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getBackendUrl, getToken } from '@/lib/api';
import type { IntegrationsStatus } from '@/hooks/useIntegrationsStatus';

interface GitHubCardProps {
  status: IntegrationsStatus['github'];
  onDisconnect: () => void;
  disconnecting: boolean;
}

export function GitHubCard({ status, onDisconnect, disconnecting }: GitHubCardProps) {
  function handleConnect() {
    const token = getToken();
    const base = getBackendUrl();
    const url = token
      ? `${base}/api/oauth/github/authorize?action=connect&token=${encodeURIComponent(token)}`
      : `${base}/api/oauth/github/authorize?action=login`;
    window.location.href = url;
  }

  function handleSignIn() {
    window.location.href = `${getBackendUrl()}/api/oauth/github/authorize?action=login`;
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Github className="size-4" />
        <h2 className="text-[15px] font-semibold">GitHub</h2>
      </div>

      {status.connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Connected as <strong>@{status.accountLogin}</strong></span>
          </div>
          {status.connectedAt && (
            <p className="text-[12px] text-muted-foreground">
              Connected {new Date(status.connectedAt).toLocaleString()}
            </p>
          )}
          <Button variant="outline" size="sm" onClick={onDisconnect} disabled={disconnecting}>
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] text-muted-foreground">Not connected</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleConnect}>
              Connect GitHub
            </Button>
            <Button size="sm" variant="outline" onClick={handleSignIn}>
              Sign in with GitHub
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
