'use client';

import { Search, FolderTree, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TreeNodeItem } from './TreeNode';
import type { TreeNode } from '@/types';

interface FileTreeProps {
  tree: TreeNode | undefined;
  isLoading: boolean;
  isError: boolean;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  repoName?: string;
  hideHeader?: boolean;
}

export function FileTree({
  tree,
  isLoading,
  isError,
  selectedPath,
  onSelectFile,
  repoName,
  hideHeader,
}: FileTreeProps) {
  const [search, setSearch] = useState('');

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e]">
      {!hideHeader && (
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
          <FolderTree className="size-4 text-muted-foreground" />
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Explorer{repoName ? ` · ${repoName}` : ''}
          </span>
        </div>
      )}
      <div className="border-b border-border/60 p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-border/60 bg-[#252526] pl-8 text-xs"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="py-1">
          {isLoading && (
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full bg-[#2d2d2d]" />
              ))}
            </div>
          )}
          {isError && (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
              <AlertCircle className="size-8 text-destructive/70" />
              <p className="text-sm">Failed to load repository tree</p>
              <p className="text-xs">Connect a repo and wait for clone to finish</p>
            </div>
          )}
          {!isLoading && !isError && tree?.children?.map((node) => (
            <TreeNodeItem
              key={node.path}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onSelect={onSelectFile}
              searchQuery={search}
            />
          ))}
          {!isLoading && !isError && !tree?.children?.length && (
            <p className="p-4 text-center text-xs text-muted-foreground">No files indexed yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
