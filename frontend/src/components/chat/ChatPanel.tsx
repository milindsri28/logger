'use client';

import { useState } from 'react';
import { Bot, Send } from 'lucide-react';
import { PanelHeader } from '@/components/layout/PanelHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChatMutation } from '@/hooks/useChat';
import type { ChatMessage } from '@/types';
import { Sparkles } from 'lucide-react';

interface ChatPanelProps {
  repositoryId: string | null;
  vpsConnectionId: string | null;
  selectedFile: string | null;
  selectedService: string | null;
}

const QUICK_PROMPTS = ["What's wrong?", 'Root cause?', 'How to fix?'];

export function ChatPanel({
  repositoryId,
  vpsConnectionId,
  selectedFile,
  selectedService,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const chatMutation = useChatMutation();

  const canSend = !!repositoryId && !!vpsConnectionId && !!selectedService && !chatMutation.isPending;

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
    <div className="flex h-full flex-col bg-[#1a1a1a]">
      <PanelHeader icon={Sparkles} title="Assistant" subtitle={selectedService || 'Pick a service'} />

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col gap-3 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Bot className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Ask about the selected service</p>
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={!canSend}
                    onClick={() => sendMessage(q)}
                    className="rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-40"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={
                  msg.role === 'user'
                    ? 'ml-4 rounded-lg bg-primary/15 px-3 py-2 text-sm'
                    : 'mr-4 whitespace-pre-wrap rounded-lg bg-[#252526] px-3 py-2 text-sm text-muted-foreground'
                }
              >
                {msg.content}
              </div>
            ))
          )}
          {chatMutation.isPending && (
            <div className="mr-4 rounded-lg bg-[#252526] px-3 py-2 text-sm text-muted-foreground">Thinking…</div>
          )}
        </div>
      </div>

      <form onSubmit={handleSend} className="shrink-0 border-t border-border/60 p-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            className="border-border/60 bg-[#252526] text-sm"
            disabled={!canSend}
          />
          <Button type="submit" size="icon" disabled={!canSend}>
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
