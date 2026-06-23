'use client';

import { useMemo, useState } from 'react';
import {
  Download,
  RefreshCw,
  Radio,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  parseLogLines,
  filterLogLines,
  LINES_PER_PAGE,
  SEVERITY_OPTIONS,
  TIME_RANGE_OPTIONS,
  type LogSeverity,
} from '@/lib/log-utils';
import { cn } from '@/lib/utils';
import { getToken } from '@/lib/api';

interface LogExplorerProps {
  logs: string | undefined;
  isLoading: boolean;
  isError: boolean;
  serviceName: string | null;
  vpsConnectionId: string | null;
  autoRefresh: boolean;
  liveMode: boolean;
  onAutoRefreshChange: (v: boolean) => void;
  onLiveModeChange: (v: boolean) => void;
  onRefresh: () => void;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
}

const severityColor = {
  info: 'text-sky-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
  unknown: 'text-foreground/80',
};

const severityBadge = {
  info: 'default' as const,
  warn: 'warning' as const,
  error: 'danger' as const,
  unknown: 'secondary' as const,
};

export function LogExplorer({
  logs,
  isLoading,
  isError,
  serviceName,
  vpsConnectionId,
  autoRefresh,
  liveMode,
  onAutoRefreshChange,
  onLiveModeChange,
  onRefresh,
  searchQuery: externalSearch,
  onSearchQueryChange,
}: LogExplorerProps) {
  const [severity, setSeverity] = useState<LogSeverity>('all');
  const [timeRange, setTimeRange] = useState('');
  const [internalSearch, setInternalSearch] = useState('');
  const [page, setPage] = useState(1);
  const [linesPerPage, setLinesPerPage] = useState(LINES_PER_PAGE);

  const searchQuery = externalSearch ?? internalSearch;
  const setSearchQuery = onSearchQueryChange ?? setInternalSearch;

  const parsed = useMemo(() => parseLogLines(logs || ''), [logs]);
  const hasTimestamps = useMemo(() => parsed.some((l) => l.timestamp), [parsed]);
  const timeRangeMinutes =
    timeRange && hasTimestamps ? parseInt(timeRange, 10) : null;

  const filtered = useMemo(
    () =>
      filterLogLines(parsed, {
        severity,
        timeRangeMinutes,
        search: searchQuery,
      }),
    [parsed, severity, timeRangeMinutes, searchQuery]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / linesPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageLines = filtered.slice((currentPage - 1) * linesPerPage, currentPage * linesPerPage);

  function downloadLogs() {
    if (!serviceName || !vpsConnectionId) return;
    const token = getToken();
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    const url = `${base}/vps/logs/download?vpsConnectionId=${vpsConnectionId}&service=${encodeURIComponent(serviceName)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${serviceName}-logs.txt`;
    if (token) {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.blob())
        .then((blob) => {
          const obj = URL.createObjectURL(blob);
          a.href = obj;
          a.click();
          URL.revokeObjectURL(obj);
        });
    } else {
      a.click();
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-[#0d0d0f]">
      <div className="flex min-h-0 shrink items-center gap-2 overflow-x-auto border-b border-border/60 px-3 py-1.5 [&>*]:shrink-0">
        <div className="flex items-center gap-1.5">
          {SEVERITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setSeverity(opt.value as LogSeverity);
                setPage(1);
              }}
              className={cn(
                'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                severity === opt.value
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-1">
          {TIME_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => {
                setTimeRange(opt.value);
                setPage(1);
              }}
              disabled={opt.value !== '' && !hasTimestamps}
              title={!hasTimestamps && opt.value !== '' ? 'No timestamps in logs' : undefined}
              className={cn(
                'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                timeRange === opt.value
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                opt.value !== '' && !hasTimestamps && 'cursor-not-allowed opacity-40'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative ml-auto min-w-[140px] flex-1 max-w-[220px]">
          <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search logs…"
            className="h-7 border-border/60 bg-background pl-7 text-[11px]"
          />
        </div>

        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Switch
            checked={liveMode}
            onCheckedChange={(v) => {
              onLiveModeChange(v);
              onAutoRefreshChange(v);
            }}
          />
          Live
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Switch checked={autoRefresh} onCheckedChange={onAutoRefreshChange} />
          Auto
        </label>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={onRefresh} disabled={!serviceName}>
          <RefreshCw className="size-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={downloadLogs} disabled={!logs}>
          <Download className="size-3" />
        </Button>
      </div>

      <div className="panel-touch-scroll relative min-h-0 flex-1 overflow-auto font-mono-code text-[12px] leading-5">
        {!serviceName && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a service to view logs
          </div>
        )}
        {serviceName && isLoading && <Skeleton className="absolute inset-0 rounded-none" />}
        {serviceName && isError && (
          <div className="flex h-full items-center justify-center text-sm text-destructive">Failed to load logs</div>
        )}
        {serviceName && !isLoading && !isError && (
          <table className="w-full border-collapse">
            <tbody>
              {pageLines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No log lines match filters
                  </td>
                </tr>
              ) : (
                pageLines.map((line) => (
                  <tr key={line.lineNumber} className="hover:bg-white/[0.02]">
                    <td className="w-10 select-none px-2 py-0 text-right text-[10px] text-muted-foreground/50">
                      {line.lineNumber}
                    </td>
                    <td className="w-16 px-1 py-0">
                      {line.severity !== 'unknown' && (
                        <Badge variant={severityBadge[line.severity]} className="px-1 py-0 text-[9px] uppercase">
                          {line.severity}
                        </Badge>
                      )}
                    </td>
                    <td className={cn('whitespace-pre-wrap break-all px-2 py-0', severityColor[line.severity])}>
                      {line.raw || ' '}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex min-h-0 shrink items-center justify-between border-t border-border/60 px-3 py-1">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {liveMode && (
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <Radio className="size-3 animate-pulse" />
              Live
            </span>
          )}
          <select
            value={linesPerPage}
            onChange={(e) => {
              setLinesPerPage(parseInt(e.target.value, 10));
              setPage(1);
            }}
            className="h-6 rounded border border-border bg-background px-1.5 text-[11px]"
          >
            <option value={100}>100 lines</option>
            <option value={250}>250 lines</option>
            <option value={500}>500 lines</option>
          </select>
          <span className="text-[11px] text-muted-foreground">{filtered.length} lines</span>
        </div>
      </div>
    </div>
  );
}
