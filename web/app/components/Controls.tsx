'use client';

import { useEffect } from 'react';
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
        <div className="stickybar-right">
          <nav className="stickybar-nav" aria-label="Sections">
            {ANCHORS.map((a) => (
              <a key={a.href} href={a.href}>
                {a.label}
              </a>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

// Theme toggle. The icon shown is driven by html[data-theme] in CSS, so it
// stays correct through SSR/hydration without React holding the theme in state.
export function ThemeToggle() {
  // Keep following the OS preference until the user makes an explicit choice.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = (e: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem('theme')) return;
      } catch {
        return;
      }
      document.documentElement.setAttribute('data-theme', e.matches ? 'light' : 'dark');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* private mode: theme still applies for this session */
    }
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label="Toggle light or dark theme"
      title="Toggle theme"
    >
      <svg className="theme-icon icon-sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <g strokeLinecap="round">
          <line x1="12" y1="2.5" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="21.5" />
          <line x1="2.5" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="21.5" y2="12" />
          <line x1="5.2" y1="5.2" x2="6.9" y2="6.9" />
          <line x1="17.1" y1="17.1" x2="18.8" y2="18.8" />
          <line x1="5.2" y1="18.8" x2="6.9" y2="17.1" />
          <line x1="17.1" y1="6.9" x2="18.8" y2="5.2" />
        </g>
      </svg>
      <svg className="theme-icon icon-moon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 14.2A8 8 0 1 1 9.8 4a6.4 6.4 0 0 0 10.2 10.2Z" />
      </svg>
    </button>
  );
}

export function AgentCaption() {
  const { agent } = useView();
  const label = agent === 'codex' ? 'Codex' : 'Claude';
  return (
    <p className="agent-caption faint">
      <span className="mono">{label}</span>: {AGENT_NOTE}
    </p>
  );
}
