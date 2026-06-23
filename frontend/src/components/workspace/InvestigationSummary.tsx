'use client';

import Link from 'next/link';
import { Zap, Loader2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InvestigationReport } from '@/types';

interface InvestigationSummaryProps {
  report: InvestigationReport | null | undefined;
  incidentId?: string | null;
  isAnalyzing?: boolean;
  analyzeStep?: string;
}

function ConfidenceRing({ score }: { score: number }) {
  const pct = Math.round(score);
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative size-12 shrink-0">
      <svg className="size-12 -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="18" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke="hsl(263 70% 50%)"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold">{pct}%</span>
    </div>
  );
}

export function InvestigationSummary({
  report,
  incidentId,
  isAnalyzing,
  analyzeStep,
}: InvestigationSummaryProps) {
  if (isAnalyzing) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-3 p-4">
          <Loader2 className="size-4 animate-spin text-primary" />
          <div>
            <p className="text-[13px] font-medium">Running investigation…</p>
            <p className="text-[11px] text-muted-foreground">{analyzeStep || 'Analyzing logs and repository'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="border-border/60 bg-card/30">
        <CardContent className="p-4">
          <p className="text-[12px] text-muted-foreground">
            Run an investigation to see root cause analysis, evidence, and recommended next steps.
          </p>
        </CardContent>
      </Card>
    );
  }

  const evidence =
    report.timeline?.slice(0, 4).map((t) => t.event) ||
    report.affectedFiles?.slice(0, 3).map((f) => `${f.path}: ${f.reason || 'potentially affected'}`) ||
    [];

  return (
    <Card className="border-primary/15 bg-gradient-to-b from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-3.5 text-primary" />
            Investigation Summary
          </CardTitle>
          <ConfidenceRing score={report.confidenceScore} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Root Cause</p>
          <p className="mt-1 text-[12px] leading-relaxed text-foreground/90">{report.rootCause}</p>
        </div>

        {evidence.length > 0 && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Evidence</p>
            <ul className="mt-1 space-y-1">
              {evidence.map((item, i) => (
                <li key={i} className="flex gap-1.5 text-[11px] text-muted-foreground">
                  <span className="text-primary">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.affectedFiles?.length > 0 && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Affected Files</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {report.affectedFiles.slice(0, 5).map((f) => (
                <Badge key={f.path} variant="secondary" className="font-mono-code text-[10px]">
                  {f.path.split('/').pop()}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {report.suggestedFix && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Recommended Next Step</p>
            <p className="mt-1 text-[12px] leading-relaxed text-foreground/80">{report.suggestedFix}</p>
          </div>
        )}

        {incidentId && (
          <Button variant="outline" size="sm" className="h-7 w-full text-[11px]" asChild>
            <Link href={`/incidents/${incidentId}`}>
              <ExternalLink className="size-3" />
              View full report
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
