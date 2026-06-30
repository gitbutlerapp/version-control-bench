'use client';

import { useView } from '../state/ViewContext';
import { AGENT_NOTE, METRIC_LABELS } from '../content';
import type { AgentId, MetricId } from '@/lib/types';

const AGENT_OPTIONS: { id: AgentId; label: string }[] = [
  { id: 'both', label: 'Both' },
  { id: 'codex', label: 'Codex' },
  { id: 'claude', label: 'Claude' },
];
const METRIC_OPTIONS: { id: MetricId; label: string }[] = [
  { id: 'time', label: METRIC_LABELS.time.label },
  { id: 'ops', label: METRIC_LABELS.ops.label },
];

const ANCHORS = [
  { href: '#chores', label: 'Scenarios' },
  { href: '#method', label: 'Method' },
  { href: '#scorecard', label: 'Results' },
  { href: '#failures', label: 'Failures' },
  { href: '#provenance', label: 'About' },
];

function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={legend}>
      <span className="segmented-legend eyebrow" aria-hidden>
        {legend}
      </span>
      <div className="segmented-track">
        {options.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={value === o.id}
            className="segmented-opt num"
            data-active={value === o.id}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StickyBar() {
  const { agent, metric, setAgent, setMetric } = useView();
  return (
    <div className="stickybar">
      <div className="page stickybar-inner">
        <a href="#top" className="stickybar-brand mono">
          vc-bench
        </a>
        <div className="stickybar-controls">
          <Segmented legend="Agent" options={AGENT_OPTIONS} value={agent} onChange={setAgent} />
          <Segmented legend="Metric" options={METRIC_OPTIONS} value={metric} onChange={setMetric} />
        </div>
        <nav className="stickybar-nav" aria-label="Sections">
          {ANCHORS.map((a) => (
            <a key={a.href} href={a.href}>
              {a.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function AgentCaption() {
  const { agent } = useView();
  return (
    <p className="agent-caption faint">
      <span className="mono">{agent === 'both' ? 'Codex + Claude, averaged' : `${agent} only`}</span>
      {' · '}
      {AGENT_NOTE}
    </p>
  );
}
