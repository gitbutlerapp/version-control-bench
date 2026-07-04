import { ImageResponse } from 'next/og';
import rawData from '../data/results.json';
import type { ArmId, ResultsData } from '@/lib/types';

const data = rawData as unknown as ResultsData;

export const dynamic = 'force-static';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt =
  'Grader pass rate per tool and agent: git, Jujutsu, and GitButler operated by Codex and Claude Code on five version-control tasks.';

// The social card IS the results chart, rendered at build time from the same
// committed results.json as the page — a re-run plus deploy refreshes it.
const TOOL_COLOR: Record<ArmId, string> = {
  git: '#9aa4b2',
  'jj+skill': '#5cc8b8',
  'but+skill': '#f4a623',
};
const TOOL_LABEL: Record<ArmId, string> = {
  git: 'git',
  'jj+skill': 'Jujutsu',
  'but+skill': 'GitButler',
};
const AGENTS = ['codex', 'claude'] as const;
const AGENT_LABEL: Record<(typeof AGENTS)[number], string> = {
  codex: 'Codex',
  claude: 'Claude',
};

export default function OgImage() {
  const m = data.meta;
  const cell = (agent: string, arm: ArmId) =>
    data.cells_overall.find((c) => c.agent === agent && c.arm === arm);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0d1014',
          backgroundImage:
            'linear-gradient(#161b22 1px, transparent 1px), linear-gradient(90deg, #161b22 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          padding: '56px 72px',
          fontFamily: 'sans-serif',
          color: '#e7eaef',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 10, height: 28, background: '#f4a623' }} />
            <div
              style={{
                fontSize: 22,
                letterSpacing: 5,
                textTransform: 'uppercase',
                color: '#9aa4b2',
              }}
            >
              vcbench.dev
            </div>
          </div>
          <div style={{ fontSize: 22, color: '#626d7c' }}>
            {`${m.scenarios.length} scenarios · k=${m.k} · ${m.total_runs} graded runs · ${m.snapshot_date}`}
          </div>
        </div>

        <div
          style={{
            fontSize: 50,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: -1,
            maxWidth: 1020,
          }}
        >
          Which version-control tool should you give your coding agent?
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {m.arm_order.map((arm) => (
            <div key={arm} style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
              <div
                style={{
                  width: 150,
                  fontSize: 27,
                  fontWeight: 700,
                  color: TOOL_COLOR[arm],
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                {TOOL_LABEL[arm]}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                {AGENTS.map((agent) => {
                  const c = cell(agent, arm);
                  const frac = c ? c.pass / c.n : 0;
                  return (
                    <div key={agent} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 84, fontSize: 19, color: '#626d7c' }}>
                        {AGENT_LABEL[agent]}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          width: 620,
                          height: 24,
                          background: '#1a212b',
                          borderRadius: 6,
                        }}
                      >
                        <div
                          style={{
                            width: Math.max(6, Math.round(frac * 620)),
                            height: 24,
                            background: TOOL_COLOR[arm],
                            borderRadius: 6,
                            opacity: frac === 1 ? 1 : 0.62,
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: 21,
                          color: frac === 1 ? '#e7eaef' : '#9aa4b2',
                          fontWeight: frac === 1 ? 700 : 400,
                        }}
                      >
                        {c ? `${c.pass}/${c.n}` : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            color: '#626d7c',
            fontSize: 19,
            gap: 48,
          }}
        >
          <div>{'runs passing the deterministic grader'}</div>
          <div>{'maintained by GitButler, one of the three tools measured'}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
