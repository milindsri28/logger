'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSetupStatus } from '@/hooks/useSetupStatus';

export default function OnboardingPage() {
  const router = useRouter();
  const { data: setup, isLoading } = useSetupStatus();

  useEffect(() => {
    if (isLoading) return;
    if (setup?.canUseWorkspace) {
      router.replace('/workspace');
      return;
    }
    router.replace('/integrations');
  }, [setup, isLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-[13px] text-muted-foreground">
      Loading setup…
    </div>
  );
}
