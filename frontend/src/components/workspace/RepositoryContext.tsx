'use client';

import { FileCode2, GitCommit, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { GitCommit as Commit, RelevantFile } from '@/types';

interface RepositoryContextProps {
  files: RelevantFile[] | undefined;
  commits: Commit[] | undefined;
  filesLoading: boolean;
  commitsLoading: boolean;
  repoOwner?: string;
  repoName?: string;
  onSelectFile: (path: string) => void;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function RepositoryContext({
  files,
  commits,
  filesLoading,
  commitsLoading,
  repoOwner,
  repoName,
  onSelectFile,
}: RepositoryContextProps) {
  const githubUrl = repoOwner && repoName ? `https://github.com/${repoOwner}/${repoName}` : null;

  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-hidden sm:flex-row sm:items-stretch">
      <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-border/60 bg-card/50">
        <CardHeader className="shrink-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <FileCode2 className="size-3.5 text-primary/70" />
            Recently Relevant Files
          </CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-auto">
          {filesLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          )}
          {!filesLoading && (!files || files.length === 0) && (
            <p className="py-4 text-center text-[12px] text-muted-foreground">No recent file changes found</p>
          )}
          {!filesLoading && files && files.length > 0 && (
            <ul className="space-y-1">
              {files.map((file) => (
                <li key={file.path}>
                  <button
                    type="button"
                    onClick={() => onSelectFile(file.path)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left',
                      'text-[12px] transition-colors hover:bg-accent'
                    )}
                  >
                    <span className="truncate font-mono-code text-primary/90">{file.path}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {file.changeCount} change{file.changeCount !== 1 ? 's' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-border/60 bg-card/50">
        <CardHeader className="shrink-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <GitCommit className="size-3.5 text-primary/70" />
            Recent Commits
          </CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-auto">
          {commitsLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}
          {!commitsLoading && (!commits || commits.length === 0) && (
            <p className="py-4 text-center text-[12px] text-muted-foreground">No commits found</p>
          )}
          {!commitsLoading && commits && commits.length > 0 && (
            <ul className="space-y-2">
              {commits.slice(0, 6).map((commit) => (
                <li
                  key={commit.sha}
                  className="rounded-md border border-border/40 bg-background/40 px-3 py-2"
                >
                  <p className="truncate text-[12px] font-medium">{commit.message}</p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground/70">{commit.author}</span>
                    <span>·</span>
                    <span>{timeAgo(commit.date)}</span>
                    <code className="ml-auto font-mono-code text-primary/80">{commit.sha}</code>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {githubUrl && (
            <Button variant="outline" size="sm" className="mt-3 h-7 w-full text-[11px]" asChild>
              <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3" />
                View on GitHub
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
