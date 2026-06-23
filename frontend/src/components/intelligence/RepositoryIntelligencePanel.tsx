'use client';

import {
  Activity,
  Database,
  FileCode2,
  GitBranch,
  Globe,
  Layers,
  Loader2,
  Package,
  Plug,
  Radar,
  ScanSearch,
  Server,
  Variable,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IntelligenceCard, PillList, StatTile, timeAgo } from '@/components/intelligence/IntelligenceCard';
import {
  useAnalyzeRepository,
  useApiInventory,
  useDetectedDatabases,
  useDetectedIntegrations,
  useDetectedServices,
  useEnvVars,
  useHotFiles,
  useProjectInfo,
  useRepositoryStats,
  useScanCommits,
  useScanStatus,
} from '@/hooks/useRepositoryIntelligence';
import { cn } from '@/lib/utils';

interface RepositoryIntelligencePanelProps {
  repositoryId: string;
  branch: string;
  repoOwner?: string;
  repoName?: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-400',
  POST: 'bg-blue-500/15 text-blue-400',
  PUT: 'bg-amber-500/15 text-amber-400',
  PATCH: 'bg-orange-500/15 text-orange-400',
  DELETE: 'bg-red-500/15 text-red-400',
  ALL: 'bg-violet-500/15 text-violet-400',
};

export function RepositoryIntelligencePanel({
  repositoryId,
  branch,
  repoOwner,
  repoName,
}: RepositoryIntelligencePanelProps) {
  const { data: scanStatus } = useScanStatus(repositoryId, branch);
  const analyze = useAnalyzeRepository(repositoryId, branch);
  const hasScan = scanStatus?.status === 'completed';
  const canShowData = hasScan || analyze.isSuccess;

  const projectInfo = useProjectInfo(repositoryId, branch, canShowData);
  const stats = useRepositoryStats(repositoryId, branch, canShowData);
  const services = useDetectedServices(repositoryId, branch, canShowData);
  const databases = useDetectedDatabases(repositoryId, branch, canShowData);
  const integrations = useDetectedIntegrations(repositoryId, branch, canShowData);
  const envVars = useEnvVars(repositoryId, branch, canShowData);
  const apis = useApiInventory(repositoryId, branch, canShowData);
  const hotFiles = useHotFiles(repositoryId, branch, canShowData);
  const commits = useScanCommits(repositoryId, branch, canShowData);

  const githubBase =
    repoOwner && repoName ? `https://github.com/${repoOwner}/${repoName}` : null;

  async function handleAnalyze() {
    analyze.reset();
    await analyze.mutateAsync();
  }

  const showEmpty = !canShowData && !analyze.isPending;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/60 bg-card/30 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/20">
                <Radar className="size-4 text-primary" />
              </div>
              <div>
                <h1 className="text-[15px] font-semibold tracking-tight">Repository Intelligence</h1>
                <p className="text-[12px] text-muted-foreground">
                  Deterministic static analysis — no AI, branch-scoped insights
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1 font-mono-code text-[10px]">
                <GitBranch className="size-3" />
                {branch}
              </Badge>
              {scanStatus?.status && scanStatus.status !== 'none' && (
                <Badge
                  variant={scanStatus.status === 'completed' ? 'success' : scanStatus.status === 'failed' ? 'danger' : 'warning'}
                  className="text-[10px] capitalize"
                >
                  {scanStatus.status}
                </Badge>
              )}
              {scanStatus?.scannedAt && (
                <span className="text-[11px] text-muted-foreground">
                  Last scanned {timeAgo(scanStatus.scannedAt)}
                </span>
              )}
            </div>
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={analyze.isPending}
            className="h-9 gap-2 text-[12px]"
          >
            {analyze.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <ScanSearch className="size-3.5" />
                Analyze Repository
              </>
            )}
          </Button>
        </div>

        {analyze.isError && (
          <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
            {analyze.error instanceof Error ? analyze.error.message : 'Analysis failed'}
          </p>
        )}
        {scanStatus?.status === 'failed' && scanStatus.errorMessage && !analyze.isPending && (
          <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
            {scanStatus.errorMessage}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {showEmpty && (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/20 px-6 text-center">
            <ScanSearch className="mb-3 size-10 text-muted-foreground/40" />
            <h2 className="text-[14px] font-medium">No scan for this branch yet</h2>
            <p className="mt-1 max-w-md text-[12px] text-muted-foreground">
              Click &quot;Analyze Repository&quot; to run static analysis on branch{' '}
              <span className="font-mono-code text-foreground/80">{branch}</span>. Results are stored
              per branch.
            </p>
          </div>
        )}

        {!showEmpty && (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <IntelligenceCard
              title="Project Information"
              icon={<Package className="size-3.5 text-primary/70" />}
              loading={analyze.isPending || (canShowData && projectInfo.isLoading)}
              error={projectInfo.error?.message}
              empty={canShowData && !projectInfo.data?.projectInfo}
              className="lg:col-span-1"
            >
              {projectInfo.data?.projectInfo && (
                <dl className="space-y-3">
                  <InfoRow label="Framework" value={projectInfo.data.projectInfo.framework} />
                  <InfoRow label="Language" value={projectInfo.data.projectInfo.language} />
                  <InfoRow label="Package Manager" value={projectInfo.data.projectInfo.packageManager} />
                </dl>
              )}
            </IntelligenceCard>

            <IntelligenceCard
              title="Repository Statistics"
              icon={<Activity className="size-3.5 text-primary/70" />}
              loading={analyze.isPending || (canShowData && stats.isLoading)}
              error={stats.error?.message}
              empty={canShowData && !stats.data?.stats}
              className="lg:col-span-2"
            >
              {stats.data?.stats && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  <StatTile label="Files" value={stats.data.stats.totalFiles} />
                  <StatTile label="Folders" value={stats.data.stats.totalFolders} />
                  <StatTile label="APIs" value={stats.data.stats.totalApis} />
                  <StatTile label="Services" value={stats.data.stats.totalServices} />
                  <StatTile label="Commits" value={stats.data.stats.totalCommits} />
                </div>
              )}
            </IntelligenceCard>

            <IntelligenceCard
              title="Detected Services"
              icon={<Server className="size-3.5 text-primary/70" />}
              loading={analyze.isPending || (canShowData && services.isLoading)}
              error={services.error?.message}
              empty={canShowData && (services.data?.services?.length ?? 0) === 0}
              emptyMessage="No Docker services detected"
            >
              <PillList items={services.data?.services ?? []} />
            </IntelligenceCard>

            <IntelligenceCard
              title="Detected Databases"
              icon={<Database className="size-3.5 text-primary/70" />}
              loading={analyze.isPending || (canShowData && databases.isLoading)}
              error={databases.error?.message}
              empty={canShowData && (databases.data?.databases?.length ?? 0) === 0}
              emptyMessage="No databases detected"
            >
              <PillList items={databases.data?.databases ?? []} />
            </IntelligenceCard>

            <IntelligenceCard
              title="External Integrations"
              icon={<Plug className="size-3.5 text-primary/70" />}
              loading={analyze.isPending || (canShowData && integrations.isLoading)}
              error={integrations.error?.message}
              empty={canShowData && (integrations.data?.integrations?.length ?? 0) === 0}
              emptyMessage="No external integrations detected"
            >
              <PillList items={integrations.data?.integrations ?? []} />
            </IntelligenceCard>

            <IntelligenceCard
              title="Environment Variables"
              icon={<Variable className="size-3.5 text-primary/70" />}
              loading={analyze.isPending || (canShowData && envVars.isLoading)}
              error={envVars.error?.message}
              empty={canShowData && (envVars.data?.envVars?.length ?? 0) === 0}
              emptyMessage="No environment variables detected"
              className="lg:col-span-2 xl:col-span-3"
            >
              <PillList items={envVars.data?.envVars ?? []} variant="outline" />
              <p className="mt-2 text-[10px] text-muted-foreground">Variable names only — values are never exposed.</p>
            </IntelligenceCard>

            <IntelligenceCard
              title="API Inventory"
              icon={<Globe className="size-3.5 text-primary/70" />}
              loading={analyze.isPending || (canShowData && apis.isLoading)}
              error={apis.error?.message}
              empty={canShowData && (apis.data?.apis?.length ?? 0) === 0}
              emptyMessage="No API routes detected"
              className="lg:col-span-2 xl:col-span-3"
            >
              <div className="max-h-[280px] overflow-y-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-border/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">Method</th>
                      <th className="pb-2 pr-3 font-medium">Path</th>
                      <th className="pb-2 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apis.data?.apis.map((api, i) => (
                      <tr key={`${api.method}-${api.path}-${api.file}-${i}`} className="border-b border-border/30">
                        <td className="py-1.5 pr-3">
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 font-mono-code text-[10px] font-semibold',
                              METHOD_COLORS[api.method] || 'bg-muted text-muted-foreground'
                            )}
                          >
                            {api.method}
                          </span>
                        </td>
                        <td className="py-1.5 pr-3 font-mono-code text-primary/90">{api.path}</td>
                        <td className="py-1.5 font-mono-code text-[11px] text-muted-foreground">{api.file}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </IntelligenceCard>

            <IntelligenceCard
              title="Hot Files"
              icon={<FileCode2 className="size-3.5 text-primary/70" />}
              loading={analyze.isPending || (canShowData && hotFiles.isLoading)}
              error={hotFiles.error?.message}
              empty={canShowData && (hotFiles.data?.hotFiles?.length ?? 0) === 0}
              emptyMessage="No hot files found"
            >
              <ul className="max-h-[280px] space-y-1 overflow-y-auto">
                {hotFiles.data?.hotFiles.map((file) => (
                  <li
                    key={file.path}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
                  >
                    <span className="truncate font-mono-code text-[11px] text-foreground/90">{file.path}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {file.commitCount} commits
                    </span>
                  </li>
                ))}
              </ul>
            </IntelligenceCard>

            <IntelligenceCard
              title="Recent Commits"
              icon={<Layers className="size-3.5 text-primary/70" />}
              loading={analyze.isPending || (canShowData && commits.isLoading)}
              error={commits.error?.message}
              empty={canShowData && (commits.data?.commits?.length ?? 0) === 0}
              emptyMessage="No recent commits"
              className="lg:col-span-2"
            >
              <ul className="max-h-[280px] space-y-2 overflow-y-auto">
                {commits.data?.commits.map((commit) => (
                  <li key={commit.hash} className="rounded-md border border-border/40 bg-background/30 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] font-medium leading-snug">{commit.message}</p>
                      {githubBase && (
                        <a
                          href={`${githubBase}/commit/${commit.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 font-mono-code text-[10px] text-primary hover:underline"
                        >
                          {commit.hash.slice(0, 7)}
                        </a>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {commit.author} · {timeAgo(commit.timestamp)}
                    </p>
                  </li>
                ))}
              </ul>
            </IntelligenceCard>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-background/30 px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-[12px] font-medium">{value}</dd>
    </div>
  );
}
