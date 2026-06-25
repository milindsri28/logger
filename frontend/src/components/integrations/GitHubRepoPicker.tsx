'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Github, Loader2, Lock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAvailableRepositories } from '@/hooks/useAvailableRepositories';

interface GitHubRepoPickerProps {
  enabled: boolean;
  onConnected?: () => void;
}

export function GitHubRepoPicker({ enabled, onConnected }: GitHubRepoPickerProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch, isFetching } = useAvailableRepositories(enabled);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success');

  const repositories = data?.repositories ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return repositories;
    return repositories.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q)
    );
  }, [repositories, search]);

  const selectable = filtered.filter((r) => !r.connected);

  function toggle(fullName: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(selectable.map((r) => r.fullName)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleConnect() {
    if (selected.size === 0) return;
    setConnecting(true);
    setMessage('');
    try {
      const repoUrls = repositories
        .filter((r) => selected.has(r.fullName))
        .map((r) => r.htmlUrl);

      const result = await api<{
        connected: Array<{ id: string; owner: string; name: string; repoUrl: string }>;
        errors: Array<{ repoUrl: string; message: string }>;
      }>('/github/repositories/connect', {
        method: 'POST',
        body: JSON.stringify({ repoUrls }),
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['github-available-repositories'] }),
        queryClient.invalidateQueries({ queryKey: ['repositories'] }),
        queryClient.invalidateQueries({ queryKey: ['setup-status'] }),
      ]);

      setSelected(new Set());
      await refetch();
      onConnected?.();

      if (result.connected.length > 0 && result.errors.length === 0) {
        setMessageTone('success');
        setMessage(
          `Connected ${result.connected.length} repositor${result.connected.length === 1 ? 'y' : 'ies'}. Cloning in background.`
        );
      } else if (result.connected.length > 0) {
        setMessageTone('success');
        setMessage(
          `Connected ${result.connected.length}. ${result.errors.length} failed: ${result.errors.map((e) => e.message).join('; ')}`
        );
      } else {
        setMessageTone('error');
        setMessage(result.errors.map((e) => e.message).join('; ') || 'Failed to connect repositories');
      }
    } catch (err) {
      setMessageTone('error');
      setMessage(err instanceof Error ? err.message : 'Failed to connect repositories');
    } finally {
      setConnecting(false);
    }
  }

  if (!enabled) return null;

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Github className="size-4" />
          <div>
            <h2 className="text-[15px] font-semibold">Choose repositories</h2>
            <p className="text-[12px] text-muted-foreground">
              Select which GitHub repos to clone and index. Nothing is connected until you confirm.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="size-3.5 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repositories…"
            className="h-8 pl-8 text-[13px]"
          />
        </div>
        <Button size="sm" variant="ghost" onClick={selectAllVisible} disabled={selectable.length === 0}>
          Select all
        </Button>
        <Button size="sm" variant="ghost" onClick={clearSelection} disabled={selected.size === 0}>
          Clear
        </Button>
        <Button size="sm" onClick={handleConnect} disabled={connecting || selected.size === 0}>
          {connecting && <Loader2 className="mr-1 size-3.5 animate-spin" />}
          Connect selected ({selected.size})
        </Button>
      </div>

      {message && (
        <p
          className={
            messageTone === 'error'
              ? 'mb-3 text-[12px] text-destructive'
              : 'mb-3 text-[12px] text-emerald-600'
          }
        >
          {message}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading your GitHub repositories…
        </div>
      ) : isError ? (
        <p className="py-4 text-[13px] text-destructive">
          {error instanceof Error ? error.message : 'Failed to load repositories'}
        </p>
      ) : filtered.length === 0 ? (
        <p className="py-4 text-[13px] text-muted-foreground">No repositories found.</p>
      ) : (
        <ul className="max-h-[420px] space-y-1 overflow-y-auto rounded-md border p-1">
          {filtered.map((repo) => {
            const checked = selected.has(repo.fullName);
            return (
              <li key={repo.id}>
                <label
                  className={
                    repo.connected
                      ? 'flex cursor-default items-center gap-3 rounded-md px-3 py-2 text-[13px] opacity-70'
                      : 'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-[13px] hover:bg-muted/50'
                  }
                >
                  <input
                    type="checkbox"
                    className="size-3.5 rounded border-border"
                    checked={repo.connected || checked}
                    disabled={repo.connected || connecting}
                    onChange={() => toggle(repo.fullName)}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono-code">{repo.fullName}</span>
                  {repo.private && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Lock className="size-3" />
                      private
                    </span>
                  )}
                  {repo.connected && (
                    <span className="text-[11px] font-medium text-emerald-600">Connected</span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
