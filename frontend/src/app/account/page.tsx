'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import {
  Github,
  Server,
  AlarmClock,
  RefreshCw,
  Trash2,
  PlugZap,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  ExternalLink,
} from 'lucide-react';

type Tab = 'github' | 'vps' | 'history';

interface Repo {
  id: string;
  repoUrl: string;
  owner: string;
  name: string;
  cloneStatus: string;
  indexStatus: string;
  fileCount: number;
  failureReason?: string | null;
}

interface VpsConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: string;
}

interface Incident {
  id: string;
  title: string;
  status: string;
  logSources: string[];
  createdAt: string;
}

const tabs: { id: Tab; label: string; icon: typeof Github }[] = [
  { id: 'github', label: 'Source Control', icon: Github },
  { id: 'vps', label: 'Infrastructure', icon: Server },
  { id: 'history', label: 'Incidents', icon: AlarmClock },
];

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <AuthGuard>
          <AppShell>
            <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
              Loading…
            </div>
          </AppShell>
        </AuthGuard>
      }
    >
      <AccountContent />
    </Suspense>
  );
}

function AccountContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'github';
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    const t = searchParams.get('tab') as Tab;
    if (t && tabs.some((x) => x.id === t)) setTab(t);
  }, [searchParams]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="h-full overflow-auto bg-background">
          <div className="mx-auto max-w-3xl px-6 py-7">
            <div className="mb-7">
              <h1 className="text-[18px] font-semibold">Integrations</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Manage connected services, repositories, and incident history.
              </p>
            </div>

            <div className="mb-6 flex gap-1 rounded-lg border border-border bg-card p-1">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
                    tab === id
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {tab === 'github' && <GitHubSection />}
            {tab === 'vps' && <VpsSection />}
            {tab === 'history' && <HistorySection />}
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-5">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[13px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function GitHubSection() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repoUrl, setRepoUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function loadRepos() {
    api<{ repositories: Repo[] }>('/github/repositories')
      .then((d) => setRepos(d.repositories))
      .catch(console.error);
  }

  useEffect(() => {
    loadRepos();
  }, []);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api('/github/connect', { method: 'POST', body: JSON.stringify({ githubToken }) });
      await api('/github/repository', {
        method: 'POST',
        body: JSON.stringify({ repoUrl, ...(githubToken ? { githubToken } : {}) }),
      });
      setSuccess('Repository added — cloning in background.');
      setRepoUrl('');
      loadRepos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionCard title="Add repository" description="Pick repos from GitHub on the Integrations page, or add manually with a PAT below.">
        <div className="mb-4">
          <Link href="/integrations">
            <Button size="sm" variant="outline">
              Choose from GitHub
            </Button>
          </Link>
        </div>
        <form onSubmit={handleConnect} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              <p className="text-[13px] text-destructive">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
              <p className="text-[13px] text-emerald-400">{success}</p>
            </div>
          )}
          <Field label="GitHub personal access token">
            <Input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_…"
              required
            />
          </Field>
          <Field label="Repository URL">
            <Input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              required
            />
          </Field>
          <Button type="submit" disabled={loading} size="sm">
            {loading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            {loading ? 'Connecting…' : 'Add repository'}
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Connected repositories">
        {repos.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No repositories connected yet.</p>
        ) : (
          <ul className="space-y-2">
            {repos.map((repo) => (
              <li
                key={repo.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">
                    {repo.owner}/{repo.name}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <RepoStatusBadge status={repo.cloneStatus} label={`Clone: ${repo.cloneStatus}`} />
                    <RepoStatusBadge status={repo.indexStatus} label={`Index: ${repo.indexStatus}`} />
                    {repo.failureReason && (
                      <span className="truncate text-[11px] text-destructive/80">
                        {repo.failureReason.slice(0, 60)}
                      </span>
                    )}
                    {repo.fileCount > 0 && (
                      <span className="text-[11px] text-muted-foreground">{repo.fileCount.toLocaleString()} files</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await api(`/github/repositories/${repo.id}/sync`, { method: 'POST' });
                      loadRepos();
                    }}
                  >
                    <RefreshCw className="size-3.5" />
                    Sync
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      if (!confirm('Delete this repository?')) return;
                      await api(`/github/repositories/${repo.id}`, { method: 'DELETE' });
                      loadRepos();
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function VpsSection() {
  const [connections, setConnections] = useState<VpsConnection[]>([]);
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('root');
  const [authType, setAuthType] = useState<'key' | 'password'>('password');
  const [credential, setCredential] = useState('');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  function loadConnections() {
    api<{ connections: VpsConnection[] }>('/vps/connections')
      .then((d) => setConnections(d.connections))
      .catch(console.error);
  }

  useEffect(() => {
    loadConnections();
  }, []);

  function sanitizeHost(value: string) {
    let h = value.trim().replace(/^ssh\s+/i, '');
    const atIdx = h.lastIndexOf('@');
    if (atIdx !== -1) h = h.slice(atIdx + 1);
    return h.replace(/:\d+$/, '').trim();
  }

  function sanitizeUsername(value: string) {
    let u = value.trim().replace(/^ssh\s+/i, '');
    const m = u.match(/^([^@\s]+)@/);
    if (m) return m[1];
    return u.split('@')[0];
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const cleanHost = sanitizeHost(host);
    const cleanUser = sanitizeUsername(username);
    if (!cleanHost || cleanHost.includes(' ')) {
      setError('Host must be a plain IP or hostname. Do not include "ssh" or "user@".');
      return;
    }
    setLoading(true);
    try {
      await api('/vps/connect', {
        method: 'POST',
        body: JSON.stringify({
          name,
          host: cleanHost,
          port: parseInt(port, 10),
          username: cleanUser,
          authType,
          credential,
        }),
      });
      setCredential('');
      loadConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionCard title="Add VPS connection" description="Connect a server to collect production logs.">
        <form onSubmit={handleConnect} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              <p className="text-[13px] text-destructive">{error}</p>
            </div>
          )}
          <Field label="Connection name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Production server" required />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="Host (IP or hostname)">
                <Input
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="123.45.67.89"
                  required
                />
              </Field>
            </div>
            <Field label="Port">
              <Input value={port} onChange={(e) => setPort(e.target.value)} required />
            </Field>
          </div>
          <Field label="Username">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="root" required />
          </Field>
          <Field label="Authentication method">
            <div className="flex gap-4">
              {(['password', 'key'] as const).map((type) => (
                <label key={type} className="flex cursor-pointer items-center gap-2 text-[13px]">
                  <span
                    className={cn(
                      'flex size-4 items-center justify-center rounded-full border-2 transition-colors',
                      authType === type ? 'border-primary' : 'border-border'
                    )}
                    onClick={() => setAuthType(type)}
                  >
                    {authType === type && (
                      <span className="size-2 rounded-full bg-primary" />
                    )}
                  </span>
                  {type === 'password' ? 'Password' : 'SSH key'}
                </label>
              ))}
            </div>
          </Field>
          {authType === 'key' ? (
            <Field label="SSH private key">
              <textarea
                className="min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono-code text-[12px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                required
              />
            </Field>
          ) : (
            <Field label="Password">
              <Input
                type="password"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                required
              />
            </Field>
          )}
          <Button type="submit" disabled={loading} size="sm">
            {loading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            {loading ? 'Saving…' : 'Save connection'}
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Connected servers">
        {testResult && (
          <div
            className={cn(
              'mb-4 flex items-start gap-2 rounded-lg border px-3 py-2.5',
              testSuccess
                ? 'border-emerald-500/20 bg-emerald-500/10'
                : 'border-destructive/20 bg-destructive/10'
            )}
          >
            {testSuccess ? (
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            )}
            <p
              className={cn(
                'text-[13px]',
                testSuccess ? 'text-emerald-400' : 'text-destructive'
              )}
            >
              {testResult}
            </p>
          </div>
        )}
        {connections.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No servers connected yet.</p>
        ) : (
          <ul className="space-y-2">
            {connections.map((conn) => (
              <li
                key={conn.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background px-4 py-3"
              >
                <div>
                  <p className="text-[13px] font-medium">{conn.name}</p>
                  <p className="font-mono-code text-[11px] text-muted-foreground">
                    {conn.username}@{conn.host}:{conn.port}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setTestResult('Testing connection…');
                      setTestSuccess(null);
                      try {
                        const result = await api<{ success: boolean; info?: string; error?: string }>(
                          '/vps/test',
                          { method: 'POST', body: JSON.stringify({ vpsConnectionId: conn.id }) }
                        );
                        setTestSuccess(result.success);
                        setTestResult(
                          result.success
                            ? `Connected — ${result.info}`
                            : `Failed — ${result.error}`
                        );
                      } catch (err) {
                        setTestSuccess(false);
                        setTestResult(err instanceof Error ? err.message : 'Test failed');
                      }
                    }}
                  >
                    <PlugZap className="size-3.5" />
                    Test
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      if (!confirm('Delete this connection?')) return;
                      await api(`/vps/connections/${conn.id}`, { method: 'DELETE' });
                      loadConnections();
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function HistorySection() {
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    api<{ incidents: Incident[] }>('/incidents').then((d) => setIncidents(d.incidents));
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-5">
        <h2 className="text-[14px] font-semibold">Incident History</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          All investigated incidents, most recent first.
        </p>
      </div>

      {incidents.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
            <Clock className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[13px] font-medium">No incidents yet</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Run your first analysis from the Workspace.
            </p>
          </div>
          <Link href="/workspace">
            <Button variant="outline" size="sm">
              Open Workspace
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {incidents.map((i) => (
            <Link
              key={i.id}
              href={`/incidents/${i.id}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:border-primary/20 hover:bg-primary/5"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{i.title}</p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{new Date(i.createdAt).toLocaleString()}</span>
                  {i.logSources?.length > 0 && (
                    <>
                      <span>·</span>
                      <span>{i.logSources.join(', ')}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <IncidentStatusBadge status={i.status} />
                <ExternalLink className="size-3.5 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function RepoStatusBadge({ status, label }: { status: string; label: string }) {
  const variant =
    status === 'ready' || status === 'completed'
      ? 'success'
      : status === 'failed'
      ? 'danger'
      : 'warning';
  return (
    <Badge variant={variant} className="text-[10px]">
      {label}
    </Badge>
  );
}

function IncidentStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    failed: 'border-red-500/20 bg-red-500/10 text-red-400',
    analyzing: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    pending: 'border-border bg-secondary text-muted-foreground',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize',
        map[status] ?? map.pending
      )}
    >
      {status}
    </span>
  );
}
