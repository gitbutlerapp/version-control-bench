import type { ScenarioMeta } from '@/lib/types';

type Tone = 'base' | 'changed' | 'result' | 'ghost';
interface Node {
  label: string;
  tone?: Tone;
}
interface GraphSpec {
  before: Node[];
  after: Node[];
  leftovers?: string;
  beforeNote?: string;
  afterNote?: string;
}

// Hand-described topology for each chore. Labels are short; the shape carries
// the meaning (split grows nodes, squash shrinks them, reorder permutes them).
const SPECS: Record<ScenarioMeta['shape'], GraphSpec> = {
  select: {
    before: [{ label: 'worktree', tone: 'ghost' }],
    after: [{ label: 'validation', tone: 'result' }],
    beforeNote: 'validation + logging + config + notes, all dirty',
    afterNote: 'new branch',
    leftovers: 'logging · config · notes',
  },
  amend: {
    before: [
      { label: 'A', tone: 'changed' },
      { label: 'B' },
      { label: 'C', tone: 'changed' },
      { label: 'D' },
      { label: 'E', tone: 'changed' },
    ],
    after: [
      { label: 'A′', tone: 'result' },
      { label: 'B' },
      { label: 'C′', tone: 'result' },
      { label: 'D' },
      { label: 'E′', tone: 'result' },
    ],
    beforeNote: '3 fixes sitting dirty',
    afterNote: 'each folded into its commit',
    leftovers: 'debug · config notes',
  },
  split: {
    before: [{ label: 'mixed', tone: 'changed' }, { label: 'top' }],
    after: [
      { label: 'valid.', tone: 'result' },
      { label: 'scoring', tone: 'result' },
      { label: 'docs', tone: 'result' },
      { label: 'top' },
    ],
    beforeNote: 'one commit doing too much',
    afterNote: 'three clean commits, top preserved',
    leftovers: 'debug · config notes',
  },
  reorder: {
    before: [
      { label: 'A' },
      { label: 'B' },
      { label: 'C' },
      { label: 'D', tone: 'changed' },
      { label: 'E', tone: 'changed' },
      { label: 'F' },
    ],
    after: [
      { label: 'A' },
      { label: 'D', tone: 'result' },
      { label: 'E', tone: 'result' },
      { label: 'B' },
      { label: 'C' },
      { label: 'F' },
    ],
    beforeNote: 'delivery block lands late',
    afterNote: 'moved earlier, contents unchanged',
  },
  squash: {
    before: [
      { label: 'A' },
      { label: 'B', tone: 'changed' },
      { label: 'C', tone: 'changed' },
      { label: 'D' },
      { label: 'E', tone: 'changed' },
      { label: 'F', tone: 'changed' },
      { label: 'G', tone: 'changed' },
    ],
    after: [
      { label: 'A' },
      { label: 'B+C', tone: 'result' },
      { label: 'D' },
      { label: 'E+F+G', tone: 'result' },
    ],
    beforeNote: 'step-by-step noise',
    afterNote: 'two semantic commits',
  },
};

const TONE_FILL: Record<Tone, string> = {
  base: 'var(--surface-2)',
  changed: 'var(--tool-but-soft)',
  result: 'var(--tool-but)',
  ghost: 'var(--surface-inset)',
};
const TONE_STROKE: Record<Tone, string> = {
  base: 'var(--border-strong)',
  changed: 'var(--tool-but)',
  result: 'var(--tool-but)',
  ghost: 'var(--border-strong)',
};

const START_X = 56;
const GAP = 74;
const R = 9;

function Row({ nodes, y, label }: { nodes: Node[]; y: number; label: string }) {
  return (
    <g>
      <text x={8} y={y + 3} className="cg-rowlabel">
        {label}
      </text>
      {nodes.length > 1 && (
        <line
          x1={START_X}
          y1={y}
          x2={START_X + (nodes.length - 1) * GAP}
          y2={y}
          className="cg-edge"
        />
      )}
      {nodes.map((n, i) => {
        const tone = n.tone ?? 'base';
        const x = START_X + i * GAP;
        const ghost = tone === 'ghost';
        return (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r={R}
              fill={TONE_FILL[tone]}
              stroke={TONE_STROKE[tone]}
              strokeWidth={1.5}
              strokeDasharray={ghost ? '3 3' : undefined}
            />
            {/* commit dot for solid result/changed nodes */}
            {(tone === 'result' || tone === 'changed') && (
              <circle cx={x} cy={y} r={2.5} fill="var(--bg)" opacity={tone === 'result' ? 0.5 : 0} />
            )}
            <text x={x} y={y + R + 12} className="cg-nodelabel" data-tone={tone}>
              {n.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function CommitGraph({ scenario }: { scenario: ScenarioMeta }) {
  const spec = SPECS[scenario.shape];
  const maxNodes = Math.max(spec.before.length, spec.after.length);
  const width = START_X + (maxNodes - 1) * GAP + 64;
  const yBefore = 30;
  const yAfter = 112;
  const height = spec.leftovers ? 184 : 168;

  return (
    <figure className="commitgraph">
      <svg
        viewBox={`0 0 ${Math.max(width, 380)} ${height}`}
        role="img"
        aria-label={`${scenario.label}: ${spec.beforeNote ?? 'before'} becomes ${
          spec.afterNote ?? 'after'
        }`}
        preserveAspectRatio="xMinYMid meet"
      >
        <Row nodes={spec.before} y={yBefore} label="before" />
        {spec.beforeNote && (
          <text x={START_X - 4} y={yBefore + R + 30} className="cg-note">
            {spec.beforeNote}
          </text>
        )}

        {/* transition arrow */}
        <line x1={24} y1={yBefore + 30} x2={24} y2={yAfter - 18} className="cg-arrow" />
        <path d={`M24 ${yAfter - 12} l-4 -9 l8 0 z`} className="cg-arrowhead" />

        <Row nodes={spec.after} y={yAfter} label="after" />
        {spec.afterNote && (
          <text x={START_X - 4} y={yAfter + R + 30} className="cg-note">
            {spec.afterNote}
          </text>
        )}

        {spec.leftovers && (
          <text x={START_X - 4} y={yAfter + R + 48} className="cg-leftovers">
            ↳ stays uncommitted: {spec.leftovers}
          </text>
        )}
      </svg>
    </figure>
  );
}
