'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { VpsService } from '@/types';

const STORAGE_PREFIX = 'workspace-services';

function storageKey(vpsConnectionId: string) {
  return `${STORAGE_PREFIX}:${vpsConnectionId}`;
}

function readPinned(vpsConnectionId: string | null): string[] {
  if (!vpsConnectionId || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(vpsConnectionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === 'string') : [];
  } catch {
    return [];
  }
}

function writePinned(vpsConnectionId: string, names: string[]) {
  localStorage.setItem(storageKey(vpsConnectionId), JSON.stringify(names));
}

export function useWorkspaceServices(
  vpsConnectionId: string | null,
  allServices: VpsService[] | undefined
) {
  const [pinnedNames, setPinnedNames] = useState<string[]>(() => readPinned(vpsConnectionId));

  useEffect(() => {
    setPinnedNames(readPinned(vpsConnectionId));
  }, [vpsConnectionId]);

  const pinnedServices = useMemo(() => {
    if (!allServices?.length || !pinnedNames.length) return [];
    const byName = new Map(allServices.map((s) => [s.name, s]));
    return pinnedNames.map((name) => byName.get(name)).filter((s): s is VpsService => !!s);
  }, [allServices, pinnedNames]);

  const availableToAdd = useMemo(() => {
    if (!allServices?.length) return [];
    const pinned = new Set(pinnedNames);
    return allServices.filter((s) => !pinned.has(s.name));
  }, [allServices, pinnedNames]);

  const addService = useCallback(
    (name: string) => {
      if (!vpsConnectionId || pinnedNames.includes(name)) return;
      const next = [...pinnedNames, name];
      setPinnedNames(next);
      writePinned(vpsConnectionId, next);
    },
    [vpsConnectionId, pinnedNames]
  );

  const removeService = useCallback(
    (name: string) => {
      if (!vpsConnectionId) return;
      const next = pinnedNames.filter((n) => n !== name);
      setPinnedNames(next);
      writePinned(vpsConnectionId, next);
    },
    [vpsConnectionId, pinnedNames]
  );

  return {
    pinnedServices,
    availableToAdd,
    addService,
    removeService,
  };
}
