'use client';

import { useEffect } from 'react';
import { useView } from '../state/ViewContext';
import { AGENT_NOTE, REPO_URL } from '../content';
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
  { href: '#limitations', label: 'Limitations' },
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
          <a
            className="icon-btn"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Benchmark source on GitHub"
            title="Benchmark source on GitHub"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.02-1.49-2.22.48-2.69-.94-2.69-.94-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
          </a>
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
      className="icon-btn theme-toggle"
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
