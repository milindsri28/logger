'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Zap,
  AlertCircle,
  Settings,
  LogOut,
  LayoutDashboard,
  Plug,
  Plus,
  Minus,
  Github,
  Server,
  Loader2,
  FolderGit2,
  ScrollText,
} from 'lucide-react';
import { clearToken } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { VpsService } from '@/types';

interface AppShellProps {
  children: React.ReactNode;
  toolbar?: React.ReactNode;
  services?: VpsService[];
  availableServices?: VpsService[];
  servicesLoading?: boolean;
  servicesError?: boolean;
  selectedService?: string | null;
  onSelectService?: (name: string) => void;
  onAddService?: (name: string) => void;
  onRemoveService?: (name: string) => void;
  showServicesPanel?: boolean;
  activeRepo?: { owner: string; name: string } | null;
  activeVps?: { name: string; host: string } | null;
  userName?: string;
}

const navItems = [
  { href: '/workspace', label: 'Workspace', icon: LayoutDashboard },
  { href: '/repo', label: 'Repository', icon: FolderGit2 },
  { href: '/logger', label: 'Logger', icon: ScrollText },
  { href: '/account?tab=history', label: 'Incidents', icon: AlertCircle },
  { href: '/account?tab=github', label: 'Integrations', icon: Plug },
  { href: '/account', label: 'Settings', icon: Settings },
];

const statusVariant = {
  running: 'success' as const,
  down: 'danger' as const,
  warning: 'warning' as const,
};

export function AppShell({
  children,
  toolbar,
  services,
  availableServices = [],
  servicesLoading = false,
  servicesError = false,
  selectedService,
  onSelectService,
  onAddService,
  onRemoveService,
  showServicesPanel = false,
  activeRepo,
  activeVps,
  userName = 'Admin',
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [addOpen, setAddOpen] = useState(false);

  function isNavActive(href: string) {
    if (href === '/workspace') return pathname === '/workspace';
    if (href === '/repo') return pathname === '/repo';
    if (href === '/logger') return pathname === '/logger';
    if (href.includes('tab=history')) {
      return pathname.startsWith('/incidents') || pathname.includes('history');
    }
    if (href.includes('tab=github')) {
      return pathname === '/account' && typeof window !== 'undefined' && window.location.search.includes('tab=github');
    }
    if (href === '/account') {
      return pathname === '/account' && typeof window !== 'undefined' && !window.location.search.includes('tab=');
    }
    return pathname === href;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-[240px] shrink-0 flex-col border-r border-border bg-[#08080a]">
        <div className="flex h-12 items-center gap-2.5 border-b border-border px-4">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/20">
            <Zap className="size-4 text-primary" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <span className="block text-[12px] font-semibold tracking-tight">AI Debug Investigator</span>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 p-2 pt-3">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isNavItemActive = isNavActive(href);
            return (
              <Link
                key={label}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors',
                  isNavItemActive
                    ? 'bg-primary/12 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {showServicesPanel && (
          <div className="mt-2 flex-1 overflow-hidden px-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Services
              </span>
              <button
                type="button"
                onClick={() => setAddOpen((o) => !o)}
                className={cn(
                  'flex size-5 items-center justify-center rounded transition-colors',
                  addOpen ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
                title="Add service"
                aria-label="Add service"
              >
                <Plus className="size-3" />
              </button>
            </div>

            {addOpen && (
              <div className="mb-2 rounded-md border border-border/60 bg-card/40 p-1.5">
                <p className="mb-1 px-1 text-[10px] font-medium text-muted-foreground">Add to list</p>
                {servicesLoading && (
                  <div className="flex items-center gap-1.5 px-1 py-2 text-[11px] text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Loading…
                  </div>
                )}
                {servicesError && (
                  <p className="px-1 py-1 text-[10px] text-destructive">Could not load services</p>
                )}
                {!servicesLoading && !servicesError && availableServices.length === 0 && (
                  <p className="px-1 py-1 text-[10px] text-muted-foreground">No more services on server</p>
                )}
                {!servicesLoading &&
                  !servicesError &&
                  availableServices.map((svc) => (
                    <button
                      key={svc.name}
                      type="button"
                      onClick={() => {
                        onAddService?.(svc.name);
                        setAddOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Plus className="size-3 shrink-0 text-primary/70" />
                      <span className="min-w-0 flex-1 truncate font-mono-code">{svc.name}</span>
                    </button>
                  ))}
              </div>
            )}

            <div className="space-y-0.5 overflow-y-auto">
              {servicesLoading && services?.length === 0 && (
                <div className="flex items-center gap-1.5 px-2 py-2 text-[11px] text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Loading…
                </div>
              )}
              {!servicesLoading && !servicesError && (!services || services.length === 0) && (
                <p className="px-2 py-2 text-[10px] text-muted-foreground">
                  No services added. Use + to add from your server.
                </p>
              )}
              {services?.map((svc) => (
                <div
                  key={svc.name}
                  className={cn(
                    'group flex items-center gap-1 rounded-md pr-1 transition-colors',
                    selectedService === svc.name ? 'bg-primary/10' : 'hover:bg-accent/60'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectService?.(svc.name)}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors',
                      selectedService === svc.name ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  >
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        svc.status === 'running' && 'bg-emerald-400',
                        svc.status === 'warning' && 'bg-amber-400',
                        svc.status === 'down' && 'bg-red-400'
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate font-mono-code text-[11px]">{svc.name}</span>
                    <Badge variant={statusVariant[svc.status]} className="px-1 py-0 text-[9px] capitalize">
                      {svc.status === 'running' ? 'Healthy' : svc.status}
                    </Badge>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveService?.(svc.name)}
                    className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="Remove from list"
                    aria-label={`Remove ${svc.name}`}
                  >
                    <Minus className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto space-y-2 border-t border-border p-2">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Connected
          </p>

          {activeRepo && (
            <div className="rounded-lg border border-border/60 bg-card/50 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Github className="size-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-medium">GitHub</span>
                </div>
                <Badge variant="success" className="text-[9px]">
                  Connected
                </Badge>
              </div>
              <p className="mt-1 truncate font-mono-code text-[10px] text-muted-foreground">
                {activeRepo.owner}/{activeRepo.name}
              </p>
            </div>
          )}

          {activeVps && (
            <div className="rounded-lg border border-border/60 bg-card/50 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Server className="size-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-medium">VPS</span>
                </div>
                <Badge variant="success" className="text-[9px]">
                  Connected
                </Badge>
              </div>
              <p className="mt-1 truncate text-[10px] text-muted-foreground">{activeVps.host}</p>
              <p className="truncate text-[10px] font-medium text-foreground/70">{activeVps.name}</p>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-md px-1 py-1">
            <div className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-[11px] font-semibold text-primary">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium">{userName}</p>
              <p className="text-[10px] text-muted-foreground">Admin</p>
            </div>
          </div>

          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => {
              clearToken();
              router.push('/login');
            }}
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {toolbar && (
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card/80 px-4 backdrop-blur-sm">
            {toolbar}
          </header>
        )}
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <Zap className="size-5 text-primary" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-[15px] font-semibold">AI Debug Investigator</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">AI-powered incident investigation</p>
        </div>
      </div>
      <div className="w-full max-w-[400px] rounded-xl border border-border bg-card p-6 shadow-2xl shadow-black/40">
        {children}
      </div>
    </div>
  );
}
