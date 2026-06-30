'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AgentId, MetricId } from '@/lib/types';

interface ViewState {
  agent: AgentId;
  metric: MetricId;
  setAgent: (a: AgentId) => void;
  setMetric: (m: MetricId) => void;
}

const ViewCtx = createContext<ViewState | null>(null);

const AGENTS: AgentId[] = ['both', 'codex', 'claude'];
const METRICS: MetricId[] = ['time', 'ops'];

export function ViewProvider({ children }: { children: React.ReactNode }) {
  const [agent, setAgentState] = useState<AgentId>('both');
  const [metric, setMetricState] = useState<MetricId>('time');

  // hydrate from URL once on mount (client-only; fine for static export)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const a = p.get('agent') as AgentId | null;
    const m = p.get('metric') as MetricId | null;
    if (a && AGENTS.includes(a)) setAgentState(a);
    if (m && METRICS.includes(m)) setMetricState(m);
  }, []);

  const sync = useCallback((next: { agent: AgentId; metric: MetricId }) => {
    const p = new URLSearchParams(window.location.search);
    p.set('agent', next.agent);
    p.set('metric', next.metric);
    const url = `${window.location.pathname}?${p.toString()}`;
    window.history.replaceState(null, '', url);
  }, []);

  const setAgent = useCallback(
    (a: AgentId) => {
      setAgentState(a);
      sync({ agent: a, metric });
    },
    [metric, sync],
  );
  const setMetric = useCallback(
    (m: MetricId) => {
      setMetricState(m);
      sync({ agent, metric: m });
    },
    [agent, sync],
  );

  return (
    <ViewCtx.Provider value={{ agent, metric, setAgent, setMetric }}>{children}</ViewCtx.Provider>
  );
}

export function useView(): ViewState {
  const ctx = useContext(ViewCtx);
  if (!ctx) throw new Error('useView must be used within ViewProvider');
  return ctx;
}
