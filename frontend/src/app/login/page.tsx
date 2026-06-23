'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, setToken } from '@/lib/api';
import { fetchSetupStatus } from '@/hooks/useSetupStatus';
import { AuthLayout } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api<{ token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      const status = await fetchSetupStatus();
      router.push(status.canUseWorkspace ? '/workspace' : '/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="mb-6 space-y-0.5 text-center">
        <h2 className="text-[15px] font-semibold">Sign in</h2>
        <p className="text-[13px] text-muted-foreground">Continue to your workspace</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            <p className="text-[13px] text-destructive">{error}</p>
          </div>
        )}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-muted-foreground">Email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-muted-foreground">Password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
        <p className="text-center text-[13px] text-muted-foreground">
          No account?{' '}
          <Link href="/register" className="text-primary hover:underline">
            Create one
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
