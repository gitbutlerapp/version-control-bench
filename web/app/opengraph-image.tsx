import { ImageResponse } from 'next/og';
import rawData from '../data/results.json';
import type { ResultsData } from '@/lib/types';

const data = rawData as unknown as ResultsData;

export const dynamic = 'force-static';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt =
  'Which version-control tool should your coding agent use? A benchmark by GitButler.';

export default function OgImage() {
  const but = data.cells_overall.find((c) => c.agent === 'both' && c.arm === 'but+skill');
  const timeDelta = but?.vs_git ? Math.round(but.vs_git.time_pct) : -61;

  const tile = (value: string, label: string, accent: string) => ({
    value,
    label,
    accent,
  });
  const tiles = [
    tile(`${data.meta.total_passed} / ${data.meta.total_runs}`, 'runs passed the grader', '#46b17b'),
    tile(`${timeDelta}%`, 'wall time vs git, GitButler', '#f4a623'),
    tile('5 chores', '2 agents · 3 tools · k=5', '#5cc8b8'),
  ];

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
          padding: '72px',
          fontFamily: 'sans-serif',
          color: '#e7eaef',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 10, height: 32, background: '#f4a623' }} />
          <div
            style={{
              fontSize: 24,
              letterSpacing: 6,
              textTransform: 'uppercase',
              color: '#9aa4b2',
            }}
          >
            Agentic version-control benchmark
          </div>
        </div>

        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -1.5,
            maxWidth: 1000,
          }}
        >
          A version-control benchmark for coding agents
        </div>

        <div style={{ display: 'flex', gap: 28 }}>
          {tiles.map((t) => (
            <div
              key={t.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                border: '1px solid #242b35',
                borderRadius: 14,
                padding: '26px 30px',
                background: '#151a21',
              }}
            >
              <div style={{ fontSize: 52, fontWeight: 700, color: t.accent, letterSpacing: -1 }}>
                {t.value}
              </div>
              <div style={{ fontSize: 21, color: '#9aa4b2', marginTop: 8 }}>{t.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#626d7c', fontSize: 22 }}>
          <div>git · Jujutsu · GitButler — graded by a hidden oracle</div>
          <div>built by GitButler</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
