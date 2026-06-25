'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { SetupStatus } from '@/hooks/useSetupStatus';

interface SetupBannerProps {
  setup: SetupStatus | undefined;
  isLoading?: boolean;
}

export function SetupBanner({ setup, isLoading }: SetupBannerProps) {
  if (isLoading || !setup || setup.canUseWorkspace) return null;

  const steps = [
    {
      done: setup.hasGithubToken,
      label: 'Connect GitHub',
      href: '/integrations',
    },
    {
      done: setup.hasRepo,
      label: 'Add a repository',
      href: '/integrations',
    },
    {
      done: setup.repoReady,
      label:
        setup.nextStep === 'wait_clone'
          ? 'Wait for repository clone/index'
          : setup.nextStep === 'repo_failed'
            ? 'Fix repository clone failure'
            : 'Repository ready',
      href: '/integrations',
      pending: setup.nextStep === 'wait_clone',
      failed: setup.nextStep === 'repo_failed',
    },
    {
      done: setup.hasVps,
      label: 'Connect infrastructure agent',
      href: '/integrations',
    },
  ];

  const nextMessage = (() => {
    switch (setup.nextStep) {
      case 'github':
        return setup.hasGithubToken
          ? 'Next: pick a repository on Integrations.'
          : 'Next: connect GitHub on Integrations.';
      case 'wait_clone':
        return 'Next: wait for your repository to finish cloning and indexing.';
      case 'repo_failed':
        return 'Next: fix the failed repository clone on Integrations or Settings.';
      case 'vps':
        return 'Next: connect an infrastructure agent on Integrations.';
      default:
        return 'Finish the remaining setup steps to unlock the full workspace.';
    }
  })();

  return (
    <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-3">
      <div className="mx-auto flex max-w-5xl flex-col gap-2">
        <div className="flex items-start gap-2 text-[13px]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-foreground">Setup incomplete</p>
            <p className="text-muted-foreground">
              {nextMessage}
              {!setup.canUseWorkspace &&
                ' You can browse these pages, but some features stay empty until setup finishes.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pl-5">
          {steps.map((step) => (
            <Link
              key={step.label}
              href={step.href}
              className={
                step.done
                  ? 'inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-700'
                  : step.pending
                    ? 'inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-background px-2.5 py-1 text-[11px]'
                    : step.failed
                      ? 'inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] text-destructive'
                      : 'inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-[11px] hover:border-primary/40'
              }
            >
              {step.done ? (
                <CheckCircle2 className="size-3" />
              ) : step.pending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : null}
              {step.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
