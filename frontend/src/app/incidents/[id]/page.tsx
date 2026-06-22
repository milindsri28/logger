'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { ArrowLeft } from 'lucide-react';

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
    extractedSignals?: {
      errors: string[];
      fileReferences: string[];
    };
    createdAt: string;
    completedAt: string | null;
  };
  report: Report | null;
}

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<IncidentData | null>(null);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;

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
    }
    return () => clearInterval(interval);
  }, [id, polling]);

  if (!data) {
    return (
      <AuthGuard>
        <AppShell>
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">{polling ? 'Loading analysis…' : 'Incident not found'}</p>
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  const { incident, report } = data;

  if (incident.status === 'analyzing' || incident.status === 'pending') {
    return (
      <AuthGuard>
        <AppShell>
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Analyzing…</p>
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  if (incident.status === 'failed') {
    return (
      <AuthGuard>
        <AppShell>
          <div className="mx-auto max-w-2xl px-4 py-8">
            <Link href="/workspace" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" /> Workspace
            </Link>
            <h1 className="mb-2 text-xl font-bold text-destructive">Analysis failed</h1>
            <p className="text-sm text-muted-foreground">Check connections in Account.</p>
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <AppShell>
        <div className="h-full overflow-auto">
          <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
            <Link href="/workspace" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" /> Workspace
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{incident.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date(incident.createdAt).toLocaleString()} · Sources: {incident.logSources?.join(', ')}
                {report?.llmModel && ` · Model: ${report.llmModel}`}
              </p>
            </div>

          {report && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <ReportCard>
                  <p className="mb-1 text-sm text-muted-foreground">Confidence score</p>
                  <ConfidenceGauge score={report.confidenceScore} />
                </ReportCard>
                <ReportCard>
                  <p className="mb-1 text-sm text-muted-foreground">Affected files</p>
                  <p className="text-2xl font-bold">{report.affectedFiles?.length || 0}</p>
                </ReportCard>
                <ReportCard>
                  <p className="mb-1 text-sm text-muted-foreground">Relevant commits</p>
                  <p className="text-2xl font-bold">{report.relevantCommits?.length || 0}</p>
                </ReportCard>
              </div>

              <ReportCard title="Root cause">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{report.rootCause}</p>
              </ReportCard>

              <ReportCard title="Suggested fix">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{report.suggestedFix}</p>
              </ReportCard>

              {report.affectedFiles?.length > 0 && (
                <ReportCard title="Affected files">
                  <ul className="space-y-2">
                    {report.affectedFiles.map((f, i) => (
                      <li key={i} className="text-sm">
                        <code className="text-primary">{f.path}</code>
                        <p className="mt-0.5 text-muted-foreground">{f.reason}</p>
                      </li>
                    ))}
                  </ul>
                </ReportCard>
              )}

              {report.affectedFunctions?.length > 0 && (
                <ReportCard title="Affected functions">
                  <ul className="space-y-1">
                    {report.affectedFunctions.map((f, i) => (
                      <li key={i} className="font-mono text-sm">
                        <span className="text-primary">{f.name}</span>
                        <span className="text-muted-foreground">
                          {' '}
                          in {f.file}
                          {f.line ? `:${f.line}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </ReportCard>
              )}

              {report.relevantCommits?.length > 0 && (
                <ReportCard title="Relevant commits">
                  <ul className="space-y-3">
                    {report.relevantCommits.map((c, i) => (
                      <li key={i} className="border-l-2 border-primary pl-3 text-sm">
                        <code className="text-primary">{c.sha}</code>
                        <p className="mt-0.5">{c.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.author} · {new Date(c.date).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                </ReportCard>
              )}

              {report.codeSnippets?.length > 0 && (
                <ReportCard title="Code snippets">
                  <div className="space-y-4">
                    {report.codeSnippets.map((s, i) => (
                      <div key={i}>
                        <p className="mb-2 text-xs text-primary">
                          {s.path}:{s.startLine}-{s.endLine}
                        </p>
                        <pre className="overflow-x-auto rounded-lg border border-border bg-[#1a1a1a] p-4 text-xs">
                          <code>{s.code}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                </ReportCard>
              )}

              {report.timeline?.length > 0 && (
                <ReportCard title="Timeline">
                  <div className="ml-2 space-y-4 border-l-2 border-border pl-4">
                    {report.timeline.map((t, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[21px] size-2 rounded-full bg-primary" />
                        <p className="text-xs text-muted-foreground">{t.timestamp}</p>
                        <p className="mt-0.5 text-sm">{t.event}</p>
                      </div>
                    ))}
                  </div>
                </ReportCard>
              )}
            </>
          )}
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function ReportCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-[#141414] p-5">
      {title && <h2 className="mb-3 text-base font-semibold">{title}</h2>}
      {children}
    </div>
  );
}

function ConfidenceGauge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  const bar = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <p className={`text-3xl font-bold ${color}`}>{score}%</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#252526]">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
