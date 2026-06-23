'use client';

import { X } from 'lucide-react';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileViewerSheetProps {
  path: string | null;
  content: string | undefined;
  isLoading: boolean;
  onClose: () => void;
}

export function FileViewerSheet({ path, content, isLoading, onClose }: FileViewerSheetProps) {
  if (!path) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 flex h-[80vh] w-full max-w-4xl flex-col overflow-hidden',
          'rounded-xl border border-border bg-card shadow-2xl'
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="truncate font-mono-code text-[12px] text-primary">{path}</span>
          <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="relative min-h-0 flex-1">
          {isLoading && <Skeleton className="absolute inset-0 rounded-none" />}
          {!isLoading && (
            <CodeEditor value={content || '// File not found'} readOnly path={path} language="typescript" />
          )}
        </div>
      </div>
    </div>
  );
}
