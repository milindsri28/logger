'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bug, LayoutDashboard, LogOut, Settings } from 'lucide-react';
import { clearToken } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
  toolbar?: React.ReactNode;
}

const navItems = [
  { href: '/workspace', label: 'Workspace', icon: LayoutDashboard },
  { href: '/account', label: 'Account', icon: Settings },
];

export function AppShell({ children, toolbar }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0d0d] text-foreground">
      <aside className="flex w-52 shrink-0 flex-col border-r border-border/80 bg-[#141414]">
        <div className="flex h-12 items-center gap-2 border-b border-border/60 px-4">
          <Bug className="size-5 text-primary" />
          <span className="text-sm font-semibold tracking-tight">DebugOS</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-[#252526] hover:text-foreground'
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/60 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={() => {
              clearToken();
              router.push('/login');
            }}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {toolbar && (
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/80 bg-[#141414] px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">{toolbar}</div>
          </header>
        )}
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0d0d0d] p-4">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15">
          <Bug className="size-7 text-primary" />
        </div>
        <h1 className="text-xl font-semibold">DebugOS</h1>
        <p className="text-sm text-muted-foreground">Production debug workspace</p>
      </div>
      <div className="w-full max-w-md rounded-xl border border-border/60 bg-[#141414] p-6 shadow-xl">
        {children}
      </div>
    </div>
  );
}
