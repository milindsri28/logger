'use client';

import { useEffect, useRef, useState } from 'react';
import { getToken } from '@/lib/api';

import type { VpsService } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const MAX_LOG_CHARS = 500_000;

export function useAgentLogStream(
  agentId: string | null,
  serviceName: string | null,
  enabled: boolean,
  serviceType?: VpsService['type']
) {
  const [logs, setLogs] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !agentId || !serviceName) {
      setLogs('');
      setIsConnecting(false);
      setIsError(false);
      setErrorMessage(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLogs('');
    setIsConnecting(true);
    setIsError(false);
    setErrorMessage(null);

    const token = getToken();
    const params = new URLSearchParams({
      service: serviceName,
      tail: '200',
    });
    if (serviceType === 'pm2' || serviceType === 'docker' || serviceType === 'system') {
      params.set('type', serviceType);
    }
    const url = `${API_URL}/agents/${agentId}/logs/stream?${params.toString()}`;

    (async () => {
      try {
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || `Stream failed (${res.status})`);
        }

        setIsConnecting(false);
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const line = part
              .split('\n')
              .filter((l) => l.startsWith('data: '))
              .map((l) => l.slice(6))
              .join('');
            if (!line) continue;

            try {
              const event = JSON.parse(line) as { line?: string; error?: string; done?: boolean };
              if (event.error) throw new Error(event.error);
              if (event.line) {
                setLogs((prev) => {
                  const next = prev + event.line;
                  return next.length > MAX_LOG_CHARS ? next.slice(-MAX_LOG_CHARS) : next;
                });
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message !== 'cancelled') {
                throw parseErr;
              }
            }
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setIsConnecting(false);
        setIsError(true);
        setErrorMessage(err instanceof Error ? err.message : 'Log stream failed');
      }
    })();

    return () => {
      controller.abort();
      abortRef.current = null;
    };
  }, [agentId, serviceName, serviceType, enabled]);

  return { logs, isConnecting, isError, errorMessage };
}
