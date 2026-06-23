'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { ArrowLeft, FileCode2, GitCommit, Zap, Clock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Report {
  rootCause: string;
  confidenceScore: number;
  affectedFiles: Array<{ path: string; reason: string }>;
  affectedFunctions: Array<{ name: string; file: string; line?: number }>;
  relevantCommits: Array<{ sha: string; message: string; author: string; date: string }>;
  suggestedFix: string;
  codeSnippets: Array<{ path: string; startLine: number; endLine: number; code: string }>;
  timeline: Array<{ timestamp: string; event: string }>;
  llmModel: string;
}

interface IncidentData {
  incident: {
    id: string;
    title: string;
    status: string;
    logSources: string[];
    extractedSignals?: { errors: string[]; fileReferences: string[] };
    createdAt: string;
    completedAt: string | null;
  };
  report: Report | null;
}

const ANALYSIS_STEPS = [
  'Reading production logs',
  'Scanning repository',
  'Correlating signals',
  'Identifying root cause',
  'Generating report',
];

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<IncidentData | null>(null);
  const [polling, setPolling] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let stepInterval: NodeJS.Timeout;

    async function fetchIncident() {
      try {
        const result = await api<IncidentData>(`/incidents/${id}`);
        setData(result);
        if (result.incident.status === 'completed' || result.incident.status === 'failed') {
          setPolling(false);
        }
      } catch (err) {
        console.error(err);
        setPolling(false);
      }
    }

    fetchIncident();
    if (polling) {
      interval = setInterval(fetchIncident, 3000);
      stepInterval = setInterval(() => {
        setStepIndex((i) => (i + 1) % ANALYSIS_STEPS.length);
      }, 4000);
    }
    return () => {
      clearInterval(interval);
      clearInterval(stepInterval);
    };
  }, [id, polling]);

  if (!data) {
    return (
      <AuthGuard>
        <AppShell>
          <AnalyzingState steps={ANALYSIS_STEPS} activeStep={stepIndex} />
        </AppShell>
      </AuthGuard>
    );
  }

  const { incident, report } = data;

  if (incident.status === 'analyzing' || incident.status === 'pending') {
    return (
      <AuthGuard>
        <AppShell>
          <AnalyzingState steps={ANALYSIS_STEPS} activeStep={stepIndex} title={incident.title} />
        </AppShell>
      </AuthGuard>
    );
  }

  if (incident.status === 'failed') {
    return (
      <AuthGuard>
        <AppShell>
          <div className="flex h-full items-center justify-center p-8">
            <div className="w-full max-w-md">
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-destructive/10">
                <AlertTriangle className="size-5 text-destructive" />
              </div>
              <h1 className="text-base font-semibold">Analysis failed</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Investigator could not complete the analysis. Check your integrations and try again.
              </p>
              <Link
                href="/workspace"
                className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                Back to workspace
              </Link>
            </div>
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <AppShell>
        <div className="h-full overflow-auto">
          <div className="mx-auto max-w-6xl px-6 py-7">
            <div className="mb-6 flex items-center gap-2">
              <Link
                href="/account?tab=history"
                className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                Incidents
              </Link>
            </div>

            <div className="mb-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-semibold leading-tight">{incident.title}</h1>
                  <div className="mt-2 flex items-center gap-3 text-[13px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5" />
                      {new Date(incident.createdAt).toLocaleString()}
                    </span>
                    {incident.logSources?.length > 0 && (
                      <>
                        <span className="text-border">·</span>
                        <span>{incident.logSources.join(', ')}</span>
                      </>
                    )}
                  </div>
                </div>
                <StatusBadge status={incident.status} />
              </div>
            </div>

            {report && (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <div className="space-y-5 lg:col-span-2">
                  <AIReportCard report={report} />

                  {report.codeSnippets?.length > 0 && (
                    <Section title="Evidence">
                      <div className="space-y-3">
                        {report.codeSnippets.map((s, i) => (
                          <div key={i} className="overflow-hidden rounded-lg border border-border">
                            <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-3 py-2">
                              <FileCode2 className="size-3.5 shrink-0 text-primary/70" />
                              <span className="font-mono-code flex-1 truncate text-[11px] text-muted-foreground">
                                {s.path}
                              </span>
                              <span className="shrink-0 font-mono-code text-[11px] text-muted-foreground">
                                L{s.startLine}–{s.endLine}
                              </span>
                            </div>
                            <pre className="overflow-x-auto bg-background p-4 font-mono-code text-[12px] leading-relaxed text-foreground/90">
                              <code>{s.code}</code>
                            </pre>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {report.timeline?.length > 0 && (
                    <Section title="Timeline">
                      <div className="relative pl-5">
                        <div className="absolute left-[6px] top-1 bottom-1 w-px bg-border" />
                        <div className="space-y-5">
                          {report.timeline.map((t, i) => (
                            <div key={i} className="relative flex gap-4">
                              <div
                                className={cn(
                                  'absolute -left-5 top-1 z-10 size-3 rounded-full border-2',
                                  i === 0
                                    ? 'border-primary bg-primary'
                                    : 'border-border bg-card'
                                )}
                              />
                              <div>
                                <p className="text-[11px] font-mono-code text-muted-foreground">{t.timestamp}</p>
                                <p className="mt-0.5 text-[13px]">{t.event}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Section>
                  )}

                  {report.relevantCommits?.length > 0 && (
                    <Section title="Correlated Commits">
                      <div className="space-y-2">
                        {report.relevantCommits.map((c, i) => (
                          <div
                            key={i}
                            className="flex gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3"
                          >
                            <GitCommit className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <code className="font-mono-code text-[11px] text-primary">
                                  {c.sha.slice(0, 7)}
                                </code>
                                <span className="text-[12px] text-muted-foreground">{c.author}</span>
                              </div>
                              <p className="mt-0.5 truncate text-[13px]">{c.message}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {new Date(c.date).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}
                </div>

                <div className="space-y-4">
                  <MetaCard>
                    <MetaRow label="Confidence">
                      <ConfidenceGauge score={report.confidenceScore} />
                    </MetaRow>
                    <div className="border-t border-border" />
                    <MetaRow label="Detected">
                      <span className="text-[13px]">{new Date(incident.createdAt).toLocaleString()}</span>
                    </MetaRow>
                    {incident.completedAt && (
                      <MetaRow label="Analyzed">
                        <span className="text-[13px]">{new Date(incident.completedAt).toLocaleString()}</span>
                      </MetaRow>
                    )}
                    <MetaRow label="Sources">
                      <div className="flex flex-wrap gap-1">
                        {incident.logSources?.map((s, i) => (
                          <code
                            key={i}
                            className="rounded bg-secondary px-1.5 py-0.5 font-mono-code text-[11px]"
                          >
                            {s}
                          </code>
                        ))}
                      </div>
                    </MetaRow>
                    {report.llmModel && (
                      <MetaRow label="Model">
                        <code className="font-mono-code text-[11px] text-muted-foreground">{report.llmModel}</code>
                      </MetaRow>
                    )}
                  </MetaCard>

                  {report.affectedFiles?.length > 0 && (
                    <MetaCard>
                      <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                        Affected Files
                        <span className="ml-2 font-mono-code text-foreground">{report.affectedFiles.length}</span>
                      </p>
                      <ul className="space-y-3">
                        {report.affectedFiles.map((f, i) => (
                          <li key={i}>
                            <code className="block truncate font-mono-code text-[11px] text-primary">
                              {f.path}
                            </code>
                            <p className="mt-0.5 text-[12px] text-muted-foreground">{f.reason}</p>
                          </li>
                        ))}
                      </ul>
                    </MetaCard>
                  )}

                  {report.affectedFunctions?.length > 0 && (
                    <MetaCard>
                      <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                        Affected Functions
                        <span className="ml-2 font-mono-code text-foreground">{report.affectedFunctions.length}</span>
                      </p>
                      <ul className="space-y-2">
                        {report.affectedFunctions.map((f, i) => (
                          <li key={i} className="font-mono-code text-[11px]">
                            <span className="text-primary">{f.name}</span>
                            <span className="text-muted-foreground">
                              {' '}
                              {f.file}
                              {f.line ? `:${f.line}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </MetaCard>
                  )}

                  {incident.extractedSignals?.errors && incident.extractedSignals.errors.length > 0 && (
                    <MetaCard>
                      <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                        Error Signals
                      </p>
                      <ul className="space-y-1.5">
                        {incident.extractedSignals.errors.slice(0, 6).map((e, i) => (
                          <li
                            key={i}
                            className="truncate font-mono-code text-[11px] text-destructive/80"
                          >
                            {e}
                          </li>
                        ))}
                      </ul>
                    </MetaCard>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function AIReportCard({ report }: { report: Report }) {
  return (
    <div className="overflow-hidden rounded-xl border border-primary/20 bg-primary/5">
      <div className="flex items-center justify-between gap-4 border-b border-primary/15 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded bg-primary/15">
            <Zap className="size-3 text-primary" strokeWidth={2.5} />
          </div>
          <span className="text-[11px] font-medium uppercase tracking-widest text-primary/80">
            AI Investigation Report
          </span>
        </div>
        <ConfidencePill score={report.confidenceScore} />
      </div>

      <div className="p-5">
        <div className="mb-5">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Root Cause</p>
          <p className="text-[14px] leading-relaxed">{report.rootCause}</p>
        </div>

        {report.affectedFiles?.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-1.5">
            {report.affectedFiles.slice(0, 4).map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-mono-code text-[11px] text-primary/80"
              >
                <FileCode2 className="size-3" />
                {f.path.split('/').pop()}
              </span>
            ))}
            {report.affectedFiles.length > 4 && (
              <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                +{report.affectedFiles.length - 4} more
              </span>
            )}
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Suggested Fix</p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">{report.suggestedFix}</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

function MetaCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    completed: {
      label: 'Completed',
      className: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-400',
      icon: CheckCircle2,
    },
    failed: {
      label: 'Failed',
      className: 'border-red-500/20 bg-red-500/8 text-red-400',
      icon: AlertTriangle,
    },
    analyzing: {
      label: 'Analyzing',
      className: 'border-amber-500/20 bg-amber-500/8 text-amber-400',
      icon: Loader2,
    },
    pending: {
      label: 'Pending',
      className: 'border-border bg-secondary text-muted-foreground',
      icon: Clock,
    },
  };
  const config = map[status] ?? map.pending;
  const Icon = config.icon;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium',
        config.className
      )}
    >
      <Icon className={cn('size-3.5', status === 'analyzing' && 'animate-spin')} />
      {config.label}
    </span>
  );
}

function ConfidencePill({ score }: { score: number }) {
  const color =
    score >= 80 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : score >= 50 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    : 'text-red-400 bg-red-500/10 border-red-500/20';
  return (
    <span className={cn('rounded-md border px-2 py-0.5 text-[11px] font-medium', color)}>
      {score}% confidence
    </span>
  );
}

function ConfidenceGauge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  const bar = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <p className={cn('text-2xl font-bold tabular-nums', color)}>{score}%</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className={cn('h-full rounded-full transition-all', bar)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function AnalyzingState({
  steps,
  activeStep,
  title,
}: {
  steps: string[];
  activeStep: number;
  title?: string;
}) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <Zap className="size-5 text-primary" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[14px] font-semibold">Investigator is working</p>
            <p className="text-[12px] text-muted-foreground">
              {title ? `Analyzing: ${title}` : 'This takes 30–60 seconds'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className={cn(
                    'size-1.5 shrink-0 rounded-full transition-colors',
                    i < activeStep
                      ? 'bg-primary'
                      : i === activeStep
                      ? 'bg-primary animate-pulse'
                      : 'bg-border'
                  )}
                />
                <span
                  className={cn(
                    'text-[13px] transition-colors',
                    i <= activeStep ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step}
                </span>
                {i < activeStep && (
                  <CheckCircle2 className="ml-auto size-3.5 text-primary" />
                )}
                {i === activeStep && (
                  <Loader2 className="ml-auto size-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-center text-[12px] text-muted-foreground">
          You can leave this page — analysis continues in background
        </p>
      </div>
    </div>
  );
}
