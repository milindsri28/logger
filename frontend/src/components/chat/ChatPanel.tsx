'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useChatMutation } from '@/hooks/useChat';
import { InvestigationSummary } from '@/components/workspace/InvestigationSummary';
import type { ChatMessage, ChatMode, InvestigationReport } from '@/types';
import { cn } from '@/lib/utils';

interface ChatPanelProps {
  repositoryId: string | null;
  vpsConnectionId: string | null;
  selectedFile: string | null;
  selectedService: string | null;
  investigationReport?: InvestigationReport | null;
  incidentId?: string | null;
  isAnalyzing?: boolean;
  analyzeStep?: string;
  headerActions?: React.ReactNode;
}

const SUGGESTED_PROMPTS = [
  'What is causing the errors?',
  'Summarize recent anomalies.',
  'Which files changed recently?',
];

const CHAT_MODES: { mode: ChatMode; label: string }[] = [
  { mode: 'question', label: 'Ask' },
  { mode: 'analyze_logs', label: 'Logs' },
  { mode: 'analyze_repository', label: 'Repo' },
  { mode: 'correlate', label: 'Correlate' },
];

export function ChatPanel({
  repositoryId,
  vpsConnectionId,
  selectedFile,
  selectedService,
  investigationReport,
  incidentId,
  isAnalyzing,
  analyzeStep,
  headerActions,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ChatMode>('question');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const chatMutation = useChatMutation();
  const bottomRef = useRef<HTMLDivElement>(null);

  const canSend = !!repositoryId && !!vpsConnectionId && !!selectedService && !chatMutation.isPending;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatMutation.isPending]);

  async function sendMessage(text: string) {
    if (!text.trim() || !canSend) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    try {
      const result = await chatMutation.mutateAsync({
        repositoryId: repositoryId!,
        vpsConnectionId: vpsConnectionId!,
        serviceName: selectedService!,
        selectedFile,
        message: text.trim(),
        mode,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.reply,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Request failed',
          timestamp: new Date(),
        },
      ]);
    }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l border-border bg-[#08080a]">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Zap className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-semibold">Investigator</h2>
            <p className="truncate text-[11px] text-muted-foreground">{selectedService || 'Select a service'}</p>
          </div>
          {headerActions}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          <div className="rounded-lg border border-border/60 bg-card/30 p-3">
            <p className="mb-2 text-[11px] font-medium text-muted-foreground">Ask Investigator</p>
            {canSend ? (
              <div className="flex flex-col gap-1">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => sendMessage(p)}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <ArrowRight className="size-3 shrink-0 text-primary/60" />
                    {p}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">Select repository, environment, and service to begin.</p>
            )}
          </div>

          <InvestigationSummary
            report={investigationReport}
            incidentId={incidentId}
            isAnalyzing={isAnalyzing}
            analyzeStep={analyzeStep}
          />

          {messages.map((msg) =>
            msg.role === 'user' ? (
              <UserMessage key={msg.id} content={msg.content} />
            ) : (
              <AIMessage key={msg.id} content={msg.content} />
            )
          )}

          {chatMutation.isPending && <AIMessageLoading />}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={handleSend} className="min-w-0 shrink-0 border-t border-border p-3">
        <div className="mb-2 flex min-w-0 flex-wrap gap-1">
          {CHAT_MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              onClick={() => setMode(m.mode)}
              className={cn(
                'rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors',
                mode === m.mode
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={canSend ? 'Ask anything about this investigation…' : 'Select a service first'}
            className="min-h-[40px] max-h-[100px] min-w-0 flex-1 border-border/60 bg-background text-[12px]"
            disabled={!canSend}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
          />
          <Button type="submit" size="icon" disabled={!canSend} className="shrink-0 self-end">
            <Send className="size-3.5" />
          </Button>
        </div>
      </form>
    </div>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[90%] rounded-lg bg-primary/12 px-3 py-2 text-[12px]">{content}</div>
    </div>
  );
}

function AIMessage({ content }: { content: string }) {
  return (
    <div className="rounded-lg border border-primary/10 bg-primary/5 px-3 py-2.5 text-[12px] leading-relaxed whitespace-pre-wrap">
      {content}
    </div>
  );
}

function AIMessageLoading() {
  return (
    <div className="rounded-lg border border-primary/10 bg-primary/5 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <span className="size-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:0ms]" />
          <span className="size-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:150ms]" />
          <span className="size-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:300ms]" />
        </div>
        <span className="text-[11px] text-muted-foreground">Analyzing…</span>
      </div>
    </div>
  );
}
