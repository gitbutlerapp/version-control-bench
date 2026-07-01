'use client';

import { useView } from '../state/ViewContext';
import { AGENT_NOTE } from '../content';
import type { RealAgentId } from '@/lib/types';

const AGENT_OPTIONS: { id: RealAgentId; label: string }[] = [
  { id: 'codex', label: 'Codex' },
  { id: 'claude', label: 'Claude' },
];

const ANCHORS = [
  { href: '#results', label: 'Results' },
  { href: '#chores', label: 'Scenarios' },
  { href: '#method', label: 'Method' },
  { href: '#failures', label: 'Failures' },
];

// The agent switch. Lives next to the table it drives, not in the header.
export function AgentToggle() {
  const { agent, setAgent } = useView();
  return (
    <div className="segmented agent-toggle" role="radiogroup" aria-label="Agent">
      <span className="segmented-legend eyebrow">Agent</span>
      <div className="segmented-track">
        {AGENT_OPTIONS.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={agent === o.id}
            className="segmented-opt"
            data-active={agent === o.id}
            onClick={() => setAgent(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StickyBar() {
  return (
    <div className="stickybar">
      <div className="page stickybar-inner">
        <a href="#top" className="stickybar-brand mono">
          vc-bench
        </a>
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
  const label = agent === 'codex' ? 'Codex' : 'Claude';
  return (
    <p className="agent-caption faint">
      <span className="mono">{label}</span> — {AGENT_NOTE}
    </p>
  );
}
