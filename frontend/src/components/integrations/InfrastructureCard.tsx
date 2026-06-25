'use client';

import { useState } from 'react';
import { Copy, Loader2, Plus, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { IntegrationsStatus } from '@/hooks/useIntegrationsStatus';

interface InfrastructureCardProps {
  agents: IntegrationsStatus['infrastructure']['agents'];
  onRefresh: () => void;
  onRemove: (agentId: string) => Promise<void>;
  removingId?: string | null;
}

export function InfrastructureCard({ agents, onRefresh, onRemove, removingId }: InfrastructureCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [label, setLabel] = useState('my-server');
  const [loading, setLoading] = useState(false);
  const [installCommand, setInstallCommand] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setError('');
    setLoading(true);
    try {
      const data = await api<{
        token: string;
        installCommand: string;
      }>('/agents/tokens', {
        method: 'POST',
        body: JSON.stringify({ label }),
      });
      setInstallCommand(data.installCommand);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate token');
    } finally {
      setLoading(false);
    }
  }

  async function copyCommand() {
    await navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Server className="size-4" />
          <h2 className="text-[15px] font-semibold">Infrastructure Agent</h2>
        </div>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 size-3.5" />
          Add Server
        </Button>
      </div>

      {dialogOpen && (
        <div className="mb-4 space-y-3 rounded-md border bg-muted/30 p-3">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-muted-foreground">Server label</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="production-api" />
          </div>
          {error && <p className="text-[12px] text-destructive">{error}</p>}
          {!installCommand ? (
            <Button size="sm" onClick={handleGenerate} disabled={loading}>
              {loading && <Loader2 className="mr-1 size-3.5 animate-spin" />}
              Generate Token
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-[12px] text-muted-foreground">Run on your Linux server:</p>
              <pre className="overflow-x-auto rounded bg-background p-2 text-[11px]">{installCommand}</pre>
              <Button size="sm" variant="outline" onClick={copyCommand}>
                <Copy className="mr-1 size-3.5" />
                {copied ? 'Copied' : 'Copy Install Command'}
              </Button>
            </div>
          )}
          <Button size="sm" variant="ghost" onClick={() => { setDialogOpen(false); setInstallCommand(''); }}>
            Close
          </Button>
        </div>
      )}

      {agents.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No agents registered yet.</p>
      ) : (
        <ul className="space-y-2">
          {agents.map((agent) => (
            <li
              key={agent.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-[13px]"
            >
              <div>
                <p className="font-medium">{agent.hostname}</p>
                <p className="text-[12px] text-muted-foreground">{agent.os || 'linux'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={
                    agent.status === 'connected'
                      ? 'size-2 rounded-full bg-emerald-500'
                      : 'size-2 rounded-full bg-muted-foreground'
                  }
                />
                <span className="capitalize text-muted-foreground">{agent.status}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
                  disabled={removingId === agent.id}
                  onClick={() => onRemove(agent.id)}
                >
                  {removingId === agent.id ? 'Removing…' : 'Remove'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
