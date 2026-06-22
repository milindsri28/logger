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
import { Github, Server, History, RefreshCw, Trash2, PlugZap } from 'lucide-react';

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
  { id: 'github', label: 'GitHub', icon: Github },
  { id: 'vps', label: 'VPS', icon: Server },
  { id: 'history', label: 'History', icon: History },
];

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <AuthGuard>
          <AppShell>
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
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
        <div className="h-full overflow-auto bg-[#0d0d0d]">
          <div className="mx-auto max-w-3xl px-4 py-8">
            <div className="mb-8">
              <h1 className="text-xl font-semibold">Account</h1>
            </div>

            <div className="mb-6 flex gap-1 rounded-lg border border-border/60 bg-[#141414] p-1">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    tab === id
                      ? 'bg-[#252526] text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="size-4" />
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

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-[#141414] p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
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
    api<{ repositories: Repo[] }>('/github/repositories').then((d) => setRepos(d.repositories)).catch(console.error);
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
      setSuccess('Repository added. Cloning in background…');
      setRepoUrl('');
      loadRepos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Add repository">
        <form onSubmit={handleConnect} className="space-y-4">
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          {success && <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{success}</p>}
          <Field label="GitHub token">
            <Input type="password" value={githubToken} onChange={(e) => setGithubToken(e.target.value)} placeholder="ghp_…" required />
          </Field>
          <Field label="Repository URL">
            <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/owner/repo" required />
          </Field>
          <Button type="submit" disabled={loading}>
            {loading ? 'Connecting…' : 'Add repository'}
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Connected repositories">
        {repos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No repositories yet.</p>
        ) : (
          <ul className="space-y-3">
            {repos.map((repo) => (
              <li
                key={repo.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-[#1a1a1a] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {repo.owner}/{repo.name}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <StatusBadge status={repo.cloneStatus} label={repo.cloneStatus} />
                    <StatusBadge status={repo.indexStatus} label={repo.indexStatus} />
                    {repo.failureReason && (
                      <Badge variant="danger" className="text-[10px]">
                        {repo.failureReason.slice(0, 80)}
                      </Badge>
                    )}
                    {repo.fileCount > 0 && <span>{repo.fileCount} files</span>}
                  </p>
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
  const [name, setName] = useState('Hostinger Production');
  const [host, setHost] = useState('145.223.19.101');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('root');
  const [authType, setAuthType] = useState<'key' | 'password'>('password');
  const [credential, setCredential] = useState('');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [error, setError] = useState('');

  function loadConnections() {
    api<{ connections: VpsConnection[] }>('/vps/connections').then((d) => setConnections(d.connections)).catch(console.error);
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
      setError('Host must be an IP only (e.g. 145.223.19.101). Do not include "ssh" or "root@".');
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
    <div className="space-y-6">
      <SectionCard title="VPS connection">
        <form onSubmit={handleConnect} className="space-y-4">
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Field label="Connection name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="Host (IP only)">
                <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="145.223.19.101" required />
              </Field>
            </div>
            <Field label="Port">
              <Input value={port} onChange={(e) => setPort(e.target.value)} required />
            </Field>
          </div>
          <Field label="Username">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="root" required />
          </Field>
          <Field label="Authentication">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={authType === 'key'} onChange={() => setAuthType('key')} />
                SSH key
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={authType === 'password'} onChange={() => setAuthType('password')} />
                Password
              </label>
            </div>
          </Field>
          {authType === 'key' ? (
            <Field label="SSH private key">
              <textarea
                className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                required
              />
            </Field>
          ) : (
            <Field label="Password">
              <Input type="password" value={credential} onChange={(e) => setCredential(e.target.value)} required />
            </Field>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Save connection'}
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Saved connections">
        {testResult && (
          <p className="mb-4 rounded-md bg-[#252526] px-3 py-2 text-sm text-muted-foreground">{testResult}</p>
        )}
        {connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No VPS connections yet.</p>
        ) : (
          <ul className="space-y-3">
            {connections.map((conn) => (
              <li
                key={conn.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-[#1a1a1a] px-4 py-3"
              >
                <div>
                  <p className="font-medium">{conn.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {conn.username}@{conn.host}:{conn.port}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setTestResult('Testing…');
                      try {
                        const result = await api<{ success: boolean; info?: string; error?: string }>('/vps/test', {
                          method: 'POST',
                          body: JSON.stringify({ vpsConnectionId: conn.id }),
                        });
                        setTestResult(result.success ? `Connected: ${result.info}` : `Failed: ${result.error}`);
                      } catch (err) {
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
    <SectionCard title="History">
      {incidents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No incidents analyzed yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-muted-foreground">
                <th className="pb-3 font-medium">Title</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Sources</th>
                <th className="pb-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id} className="border-b border-border/30">
                  <td className="py-3">
                    <Link href={`/incidents/${i.id}`} className="text-primary hover:underline">
                      {i.title}
                    </Link>
                  </td>
                  <td className="py-3">
                    <IncidentStatus status={i.status} />
                  </td>
                  <td className="py-3 text-muted-foreground">{i.logSources?.join(', ')}</td>
                  <td className="py-3 text-muted-foreground">{new Date(i.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const variant =
    status === 'ready' || status === 'completed' ? 'success' : status === 'failed' ? 'danger' : 'warning';
  return (
    <Badge variant={variant} className="text-[10px]">
      {label}
    </Badge>
  );
}

function IncidentStatus({ status }: { status: string }) {
  const variant =
    status === 'completed' ? 'success' : status === 'failed' ? 'danger' : status === 'analyzing' ? 'warning' : 'secondary';
  return <Badge variant={variant}>{status}</Badge>;
}
