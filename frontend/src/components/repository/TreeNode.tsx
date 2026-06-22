'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFileIcon, getFolderIcon } from '@/lib/file-icons';
import type { TreeNode } from '@/types';

interface TreeNodeProps {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  searchQuery: string;
}

export function TreeNodeItem({ node, depth, selectedPath, onSelect, searchQuery }: TreeNodeProps) {
  const [open, setOpen] = useState(depth < 2);
  const isDir = node.type === 'directory';
  const isSelected = selectedPath === node.path;
  const matchesSearch =
    !searchQuery || node.name.toLowerCase().includes(searchQuery.toLowerCase());

  if (!matchesSearch && isDir) {
    const childMatches = node.children?.some((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (!childMatches && searchQuery) return null;
  } else if (!matchesSearch && !isDir) {
    return null;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (isDir) setOpen(!open);
          else onSelect(node.path);
        }}
        className={cn(
          'flex w-full items-center gap-1 rounded-sm px-2 py-0.5 text-left text-sm hover:bg-accent/60',
          isSelected && 'bg-primary/20 text-primary'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isDir ? (
          <>
            {open ? <ChevronDown className="size-3.5 shrink-0 opacity-60" /> : <ChevronRight className="size-3.5 shrink-0 opacity-60" />}
            {getFolderIcon(open)}
          </>
        ) : (
          <span className="size-3.5 shrink-0" />
        )}
        {!isDir && getFileIcon(node.name)}
        <span className="truncate">{node.name}</span>
      </button>
      {isDir && open && node.children?.map((child) => (
        <TreeNodeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
          searchQuery={searchQuery}
        />
      ))}
    </div>
  );
}
