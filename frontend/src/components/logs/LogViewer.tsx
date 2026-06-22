'use client';

import { useMemo } from 'react';
import { Download, RefreshCw, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { cn } from '@/lib/utils';

interface LogViewerProps {
  logs: string | undefined;
  isLoading: boolean;
  isError: boolean;
  serviceName: string | null;
  autoRefresh: boolean;
  onAutoRefreshChange: (v: boolean) => void;
  onRefresh: () => void;
  hideHeader?: boolean;
}

export function LogViewer({
  logs,
  isLoading,
  isError,
  serviceName,
  autoRefresh,
  onAutoRefreshChange,
  onRefresh,
  hideHeader,
}: LogViewerProps) {
  const content = useMemo(() => {
    if (!logs) return '';
    return logs;
  }, [logs]);

  function downloadLogs() {
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${serviceName || 'service'}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e]">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        {!hideHeader && (
          <div className="flex items-center gap-2">
            <Terminal className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">
              Logs{serviceName ? ` · ${serviceName}` : ''}
            </span>
          </div>
        )}
        <div className={cn('flex items-center gap-3', hideHeader && 'ml-auto w-full justify-end')}>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={autoRefresh} onCheckedChange={onAutoRefreshChange} />
            Auto refresh
          </label>
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={!serviceName}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={downloadLogs} disabled={!content}>
            <Download className="size-3.5" />
            Download
          </Button>
        </div>
      </div>
      <div className="relative isolate z-0 min-h-0 min-w-0 flex-1 overflow-hidden">
        {!serviceName && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a service to view logs
          </div>
        )}
        {serviceName && isLoading && <Skeleton className="absolute inset-0 rounded-none bg-[#1e1e1e]" />}
        {serviceName && isError && (
          <div className="flex h-full items-center justify-center text-sm text-destructive">
            Failed to load logs
          </div>
        )}
        {serviceName && !isLoading && !isError && (
          <CodeEditor value={content || 'No log output'} readOnly path="logs.txt" language="plaintext" />
        )}
      </div>
    </div>
  );
}
