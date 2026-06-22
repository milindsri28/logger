'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { AuthLayout } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useSetupStatus } from '@/hooks/useSetupStatus';

type Step = 1 | 2;

export default function OnboardingPage() {
  const router = useRouter();
  const { data: setup, refetch } = useSetupStatus();
  const [step, setStep] = useState<Step>(1);

  const [githubToken, setGithubToken] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState('');

  const [name, setName] = useState('Hostinger Production');
  const [host, setHost] = useState('145.223.19.101');
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
      setGithubError(err instanceof Error ? err.message : 'Failed');
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
      setVpsError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setVpsLoading(false);
    }
  }

  const cloning = setup?.nextStep === 'wait_clone';

  return (
    <AuthGuard>
      <AuthLayout>
        <div className="mb-6 flex justify-center gap-2">
          {[1, 2].map((n) => (
            <div
              key={n}
              className={`size-2 rounded-full ${step >= n ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>

        {cloning && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Cloning repository…</p>
          </div>
        )}

        {step === 1 && !cloning && (
          <>
            <h2 className="text-center text-lg font-semibold">Connect GitHub</h2>
            <form onSubmit={handleGithubSubmit} className="mt-4 space-y-3">
              {githubError && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{githubError}</p>
              )}
              <Input
                type="password"
                placeholder="GitHub token"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                required
              />
              <Input
                placeholder="https://github.com/owner/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" disabled={githubLoading}>
                {githubLoading ? 'Connecting…' : 'Continue'}
              </Button>
            </form>
          </>
        )}

        {step === 2 && !cloning && (
          <>
            <h2 className="text-center text-lg font-semibold">Connect VPS</h2>
            <form onSubmit={handleVpsSubmit} className="mt-4 space-y-3">
              {vpsError && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{vpsError}</p>
              )}
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Connection name" required />
              <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="Host IP" required />
              <div className="grid grid-cols-3 gap-2">
                <Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="Port" required />
                <Input
                  className="col-span-2"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  required
                />
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="SSH password"
                required
              />
              <Button type="submit" className="w-full" disabled={vpsLoading}>
                {vpsLoading ? 'Saving…' : 'Open Workspace'}
              </Button>
            </form>
          </>
        )}
      </AuthLayout>
    </AuthGuard>
  );
}
