'use client';

import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ChatMode } from '@/types';

interface ChatInput {
  repositoryId: string;
  vpsConnectionId: string;
  serviceName: string;
  selectedFile?: string | null;
  message: string;
  mode?: ChatMode;
}

interface ChatResponse {
  reply: string;
  contextUsed: { service: string; file?: string };
}

export function useChatMutation() {
  return useMutation({
    mutationFn: (input: ChatInput) =>
      api<ChatResponse>('/chat/message', {
        method: 'POST',
        body: JSON.stringify({
          ...input,
          selectedFile: input.selectedFile || undefined,
        }),
      }),
  });
}
