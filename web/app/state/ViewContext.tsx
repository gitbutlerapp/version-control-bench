'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { RealAgentId } from '@/lib/types';

interface ViewState {
  agent: RealAgentId;
  setAgent: (a: RealAgentId) => void;
}

const ViewCtx = createContext<ViewState | null>(null);

const AGENTS: RealAgentId[] = ['codex', 'claude'];

export function ViewProvider({ children }: { children: React.ReactNode }) {
  const [agent, setAgentState] = useState<RealAgentId>('codex');

  // hydrate from URL once on mount (client-only; fine for static export)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const a = p.get('agent') as RealAgentId | null;
    if (a && AGENTS.includes(a)) setAgentState(a);
  }, []);

  const setAgent = useCallback((a: RealAgentId) => {
    setAgentState(a);
    const p = new URLSearchParams(window.location.search);
    p.set('agent', a);
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
  }, []);

  return <ViewCtx.Provider value={{ agent, setAgent }}>{children}</ViewCtx.Provider>;
}

export function useView(): ViewState {
  const ctx = useContext(ViewCtx);
  if (!ctx) throw new Error('useView must be used within ViewProvider');
  return ctx;
}
