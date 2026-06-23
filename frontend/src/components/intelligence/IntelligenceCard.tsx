'use client';

import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface IntelligenceCardProps {
  title: string;
  icon?: ReactNode;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  className?: string;
  children: ReactNode;
}

export function IntelligenceCard({
  title,
  icon,
  loading,
  error,
  empty,
  emptyMessage = 'No data found',
  className,
  children,
}: IntelligenceCardProps) {
  return (
    <Card className={cn('border-border/60 bg-card/50', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-[13px] font-semibold">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
        {!loading && error && (
          <p className="text-[12px] text-destructive">{error}</p>
        )}
        {!loading && !error && empty && (
          <p className="py-2 text-center text-[12px] text-muted-foreground">{emptyMessage}</p>
        )}
        {!loading && !error && !empty && children}
      </CardContent>
    </Card>
  );
}

interface StatTileProps {
  label: string;
  value: string | number;
}

export function StatTile({ label, value }: StatTileProps) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

interface PillListProps {
  items: string[];
  variant?: 'default' | 'outline';
}

export function PillList({ items, variant = 'default' }: PillListProps) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            'rounded-md px-2 py-0.5 text-[11px] font-medium',
            variant === 'default'
              ? 'bg-primary/10 text-primary'
              : 'border border-border/60 bg-background/50 text-muted-foreground'
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
