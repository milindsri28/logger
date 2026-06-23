'use client';

import { Group, Panel } from 'react-resizable-panels';
import { ResizeHandle } from '@/components/layout/ResizeHandle';

const HIT = { coarse: 48, fine: 24 };

function MockLogToolbar() {
  return (
    <div className="flex min-h-0 shrink items-center gap-2 overflow-x-auto border-b border-border/60 px-3 py-1.5 [&>*]:shrink-0">
      {Array.from({ length: 12 }).map((_, i) => (
        <button key={i} type="button" className="rounded-md px-2 py-1 text-[11px] text-muted-foreground">
          Filter {i + 1}
        </button>
      ))}
    </div>
  );
}

function MockContextCards() {
  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-hidden sm:flex-row sm:items-stretch">
      {['Files', 'Commits'].map((title) => (
        <div
          key={title}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-card/50"
        >
          <div className="shrink-0 border-b border-border/40 px-3 py-2 text-[12px] font-medium">{title}</div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="mb-2 h-10 rounded border border-border/40 bg-background/40 px-2 text-[11px] leading-10">
                Row {i + 1} — sample content
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MockChat() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l border-border bg-[#08080a]">
      <div className="shrink-0 border-b border-border px-4 py-3 text-[13px] font-semibold">Investigator</div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="mb-3 rounded-lg border border-border/60 bg-card/30 p-3 text-[11px]">
            Message block {i + 1}
          </div>
        ))}
      </div>
      <div className="min-w-0 shrink-0 border-t border-border p-3">
        <div className="mb-2 flex min-w-0 flex-wrap gap-1">
          {['Ask', 'Logs', 'Repo', 'Correlate'].map((m) => (
            <button key={m} type="button" className="rounded-md px-2 py-0.5 text-[10px] text-muted-foreground">
              {m}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 gap-2">
          <div className="min-h-[40px] min-w-0 flex-1 rounded-md border border-border bg-background" />
          <div className="size-9 shrink-0 rounded-md bg-primary/20" />
        </div>
      </div>
    </div>
  );
}

/** Dev-only page to verify bidirectional panel resize (no auth). */
export default function DevPanelsPage() {
  return (
    <div className="flex h-screen min-h-0 flex-col bg-background p-2">
      <p className="shrink-0 pb-2 text-xs text-muted-foreground">
        Dev resize test — drag separators up/down and left/right (heavy mock layout)
      </p>
      <Group id="dev-main" orientation="horizontal" className="min-h-0 flex-1" resizeTargetMinimumSize={HIT}>
        <Panel id="center" defaultSize={72} minSize={10} className="min-h-0 min-w-0">
          <Group id="dev-vertical" orientation="vertical" className="h-full min-h-0" resizeTargetMinimumSize={HIT}>
            <Panel id="logs-section" defaultSize={65} minSize={5} className="min-h-0">
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-primary/30 bg-primary/5">
                <MockLogToolbar />
                <div className="min-h-0 flex-1 overflow-auto p-2 font-mono-code text-[11px]">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div key={i}>2024-01-01 INFO log line {i + 1}</div>
                  ))}
                </div>
                <div className="flex min-h-0 shrink items-center justify-between border-t border-border/60 px-3 py-1 text-[11px] text-muted-foreground">
                  <span>Page 1 of 4</span>
                  <span>500 lines</span>
                </div>
              </div>
            </Panel>
            <ResizeHandle id="sep-logs-context" groupOrientation="vertical" />
            <Panel id="context-section" defaultSize={35} minSize={5} className="min-h-0">
              <div className="h-full min-h-0 overflow-hidden p-2">
                <MockContextCards />
              </div>
            </Panel>
          </Group>
        </Panel>
        <ResizeHandle id="sep-main-chat" groupOrientation="horizontal" />
        <Panel id="chat" defaultSize={28} minSize={5} className="min-h-0 min-w-0">
          <MockChat />
        </Panel>
      </Group>
    </div>
  );
}
