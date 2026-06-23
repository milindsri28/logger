'use client';

import { Group, Panel } from 'react-resizable-panels';
import { FolderTree, FileCode2 } from 'lucide-react';
import { FileTree } from '@/components/repository/FileTree';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { PanelHeader } from '@/components/layout/PanelHeader';
import { ResizeHandle, PanelContent } from '@/components/layout/ResizeHandle';
import { Skeleton } from '@/components/ui/skeleton';
import type { TreeNode } from '@/types';

interface RepoPanelProps {
  tree: TreeNode | undefined;
  treeLoading: boolean;
  treeError: boolean;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  repoName?: string;
  fileContent?: string;
  fileLoading: boolean;
}

export function RepoPanel({
  tree,
  treeLoading,
  treeError,
  selectedFile,
  onSelectFile,
  repoName,
  fileContent,
  fileLoading,
}: RepoPanelProps) {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-card">
      <PanelHeader icon={FolderTree} title="Repository" subtitle={repoName || 'Select repo'} />
      <div className="min-h-0 flex-1">
        <PanelContent>
          <Group
            id="repo-split"
            orientation="vertical"
            className="h-full w-full min-w-0"
            resizeTargetMinimumSize={{ coarse: 36, fine: 16 }}
          >
            <Panel id="repo-tree" defaultSize={40} minSize={20}>
              <PanelContent>
                <FileTree
                  tree={tree}
                  isLoading={treeLoading}
                  isError={treeError}
                  selectedPath={selectedFile}
                  onSelectFile={onSelectFile}
                  hideHeader
                />
              </PanelContent>
            </Panel>
            <ResizeHandle id="sep-tree-editor" groupOrientation="vertical" />
            <Panel id="repo-editor" defaultSize={60} minSize={25}>
              <PanelContent>
                <div className="flex h-full flex-col bg-background">
                  <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
                    <FileCode2 className="size-3 text-muted-foreground/60" />
                    <span className="truncate font-mono-code text-[11px] text-muted-foreground">
                      {selectedFile || 'No file selected'}
                    </span>
                  </div>
                  <div className="relative isolate z-0 min-h-0 min-w-0 flex-1 overflow-hidden">
                    {!selectedFile && (
                      <div className="flex h-full items-center justify-center p-4 text-center text-[12px] text-muted-foreground">
                        Select a file to view its source
                      </div>
                    )}
                    {selectedFile && fileLoading && <Skeleton className="h-full w-full rounded-none" />}
                    {selectedFile && !fileLoading && fileContent !== undefined && (
                      <CodeEditor value={fileContent} path={selectedFile} />
                    )}
                  </div>
                </div>
              </PanelContent>
            </Panel>
          </Group>
        </PanelContent>
      </div>
    </div>
  );
}
