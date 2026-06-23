'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { AuthLayout } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 1 | 2;

const STEPS = [
  { n: 1, label: 'Source control' },
  { n: 2, label: 'Infrastructure' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: setup, refetch } = useSetupStatus();
  const [step, setStep] = useState<Step>(1);

  const [githubToken, setGithubToken] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState('');

  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [vpsLoading, setVpsLoading] = useState(false);
  const [vpsError, setVpsError] = useState('');

  useEffect(() => {
    if (setup?.canUseWorkspace) {
      router.replace('/workspace');
    } else if (setup?.nextStep === 'vps' || setup?.hasRepo) {
      setStep(2);
    }
  }, [setup, router]);

  async function handleGithubSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGithubError('');
    setGithubLoading(true);
    try {
      await api('/github/connect', { method: 'POST', body: JSON.stringify({ githubToken }) });
      await api('/github/repository', { method: 'POST', body: JSON.stringify({ repoUrl, githubToken }) });
      await refetch();
      setStep(2);
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setGithubLoading(false);
    }
  }

  async function handleVpsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setVpsError('');
    setVpsLoading(true);
    try {
      await api('/vps/connect', {
        method: 'POST',
        body: JSON.stringify({
          name,
          host: host.trim(),
          port: parseInt(port, 10),
          username: username.trim(),
          authType: 'password',
          credential: password,
        }),
      });
      await refetch();
      router.push('/workspace');
    } catch (err) {
      setVpsError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setVpsLoading(false);
    }
  }

  const cloning = setup?.nextStep === 'wait_clone';

  return (
    <AuthGuard>
      <AuthLayout>
        <div className="mb-6">
          <div className="flex items-center gap-2">
            {STEPS.map(({ n, label }) => (
              <div key={n} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full text-[11px] font-semibold transition-colors',
                      step >= n
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground'
                    )}
                  >
                    {n}
                  </div>
                  <span
                    className={cn(
                      'text-[12px] font-medium transition-colors',
                      step === n ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {label}
                  </span>
                </div>
                {n < STEPS.length && (
                  <div className="h-px w-6 bg-border" />
                )}
              </div>
            ))}
          </div>
        </div>

        {cloning && (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto mb-3 size-5 animate-spin text-primary" />
            <p className="text-[13px] font-medium">Cloning repository…</p>
            <p className="mt-1 text-[12px] text-muted-foreground">This takes a moment. Stay on this page.</p>
          </div>
        )}

        {step === 1 && !cloning && (
          <>
            <div className="mb-5">
              <h2 className="text-[15px] font-semibold">Connect GitHub</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Add a repository for AI-powered code correlation.
              </p>
            </div>
            <form onSubmit={handleGithubSubmit} className="space-y-3">
              {githubError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  <p className="text-[13px] text-destructive">{githubError}</p>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-muted-foreground">
                  Personal access token
                </label>
                <Input
                  type="password"
                  placeholder="ghp_…"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-muted-foreground">
                  Repository URL
                </label>
                <Input
                  placeholder="https://github.com/owner/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={githubLoading}>
                {githubLoading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                {githubLoading ? 'Connecting…' : 'Continue'}
              </Button>
            </form>
          </>
        )}

        {step === 2 && !cloning && (
          <>
            <div className="mb-5">
              <h2 className="text-[15px] font-semibold">Connect infrastructure</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Connect a server to collect production logs.
              </p>
            </div>
            <form onSubmit={handleVpsSubmit} className="space-y-3">
              {vpsError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  <p className="text-[13px] text-destructive">{vpsError}</p>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-muted-foreground">Connection name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Production server"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-muted-foreground">Host IP</label>
                <Input
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="123.45.67.89"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-muted-foreground">Port</label>
                  <Input value={port} onChange={(e) => setPort(e.target.value)} required />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="block text-[13px] font-medium text-muted-foreground">Username</label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="root"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-muted-foreground">SSH password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={vpsLoading}>
                {vpsLoading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                {vpsLoading ? 'Connecting…' : 'Open workspace'}
              </Button>
            </form>
          </>
        )}

        <div className="mt-5 flex items-start gap-2 rounded-lg bg-secondary/60 px-3 py-2.5">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <p className="text-[12px] text-muted-foreground">
            Credentials are encrypted at rest. Investigator operates read-only — it never modifies your servers without explicit approval.
          </p>
        </div>
      </AuthLayout>
    </AuthGuard>
  );
}
