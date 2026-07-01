import type { ScenarioMeta } from '@/lib/types';

type Tone = 'base' | 'changed' | 'result' | 'ghost';
interface Node {
  label: string;
  tone?: Tone;
}
interface GraphSpec {
  before: Node[];
  after: Node[];
  note?: string;
  leftovers?: string;
}

// Vertical commit stacks, newest at the top (like `git log`), shown as a
// before | after diff. Fits the narrow column beside the scenario text.
const SPECS: Record<ScenarioMeta['shape'], GraphSpec> = {
  select: {
    before: [{ label: 'worktree', tone: 'ghost' }],
    after: [{ label: 'validation', tone: 'result' }],
    note: 'one topic committed on a new branch',
    leftovers: 'logging · config · notes',
  },
  amend: {
    before: [
      { label: 'E', tone: 'changed' },
      { label: 'D' },
      { label: 'C', tone: 'changed' },
      { label: 'B' },
      { label: 'A', tone: 'changed' },
    ],
    after: [
      { label: 'E′', tone: 'result' },
      { label: 'D' },
      { label: 'C′', tone: 'result' },
      { label: 'B' },
      { label: 'A′', tone: 'result' },
    ],
    note: 'each dirty fix folded into its commit',
    leftovers: 'debug · config notes',
  },
  split: {
    before: [{ label: 'top' }, { label: 'mixed', tone: 'changed' }],
    after: [
      { label: 'top' },
      { label: 'docs', tone: 'result' },
      { label: 'scoring', tone: 'result' },
      { label: 'valid.', tone: 'result' },
    ],
    note: 'one commit split into three, top kept',
    leftovers: 'debug · config notes',
  },
  reorder: {
    before: [
      { label: 'F' },
      { label: 'E', tone: 'changed' },
      { label: 'D', tone: 'changed' },
      { label: 'C' },
      { label: 'B' },
      { label: 'A' },
    ],
    after: [
      { label: 'F' },
      { label: 'C' },
      { label: 'B' },
      { label: 'E', tone: 'result' },
      { label: 'D', tone: 'result' },
      { label: 'A' },
    ],
    note: 'delivery block moved earlier · same contents',
  },
  squash: {
    before: [
      { label: 'G', tone: 'changed' },
      { label: 'F', tone: 'changed' },
      { label: 'E', tone: 'changed' },
      { label: 'D' },
      { label: 'C', tone: 'changed' },
      { label: 'B', tone: 'changed' },
      { label: 'A' },
    ],
    after: [
      { label: 'E+F+G', tone: 'result' },
      { label: 'D' },
      { label: 'B+C', tone: 'result' },
      { label: 'A' },
    ],
    note: 'noisy steps squashed into two commits',
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

const COL_BEFORE = 104;
const COL_AFTER = 176;
const R = 7;
const GAP = 30;
const TOP = 32;
const LABEL_DX = 13;

function Column({ nodes, x, side }: { nodes: Node[]; x: number; side: 'before' | 'after' }) {
  const anchor = side === 'before' ? 'end' : 'start';
  const labelX = side === 'before' ? x - LABEL_DX : x + LABEL_DX;
  return (
    <g>
      <text x={labelX} y={16} className="cg-col" textAnchor={anchor}>
        {side}
      </text>
      {nodes.length > 1 && (
        <line x1={x} y1={TOP} x2={x} y2={TOP + (nodes.length - 1) * GAP} className="cg-edge" />
      )}
      {nodes.map((n, i) => {
        const tone = n.tone ?? 'base';
        const y = TOP + i * GAP;
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
            {tone === 'result' && <circle cx={x} cy={y} r={2.2} fill="var(--bg)" opacity={0.5} />}
            <text
              x={labelX}
              y={y + 1}
              className="cg-nodelabel"
              data-tone={tone}
              textAnchor={anchor}
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// Selective commit is a different move — partition a dirty worktree, not
// reshape history. Show the four changes as uncommitted files, one pulled into
// a commit on a new branch, the rest left dirty.
function SelectGraph() {
  const changes = [
    { label: 'validation', committed: true },
    { label: 'logging' },
    { label: 'config' },
    { label: 'notes' },
  ];
  const rowY = (i: number) => 54 + i * 25;
  return (
    <figure className="commitgraph">
      <svg
        viewBox="0 0 300 190"
        role="img"
        aria-label="Selective commit: commit only the validation change on a new branch, leave logging, config and notes uncommitted"
        preserveAspectRatio="xMidYMin meet"
      >
        <text x={12} y={24} className="cg-col">
          dirty worktree
        </text>
        <rect
          x={4}
          y={34}
          width={150}
          height={118}
          rx={8}
          className="cg-box"
        />
        {changes.map((c, i) => {
          const y = rowY(i);
          const tone = c.committed ? 'result' : 'base';
          return (
            <g key={c.label}>
              <rect
                x={17}
                y={y - 5}
                width={10}
                height={10}
                rx={2}
                fill={c.committed ? 'var(--tool-but-soft)' : 'none'}
                stroke={c.committed ? 'var(--tool-but)' : 'var(--border-strong)'}
                strokeWidth={1.5}
                strokeDasharray={c.committed ? undefined : '3 2'}
              />
              <text x={34} y={y + 1} className="cg-nodelabel" data-tone={tone} textAnchor="start">
                {c.label}
              </text>
            </g>
          );
        })}

        {/* validation pulled out into a commit on a new branch */}
        <line x1={158} y1={rowY(0)} x2={210} y2={rowY(0)} className="cg-arrow" />
        <path d={`M214 ${rowY(0)} l-7 -4 l0 8 z`} className="cg-arrowhead" />
        <line x1={228} y1={rowY(0)} x2={228} y2={rowY(0) + 22} className="cg-edge" />
        <circle
          cx={228}
          cy={rowY(0)}
          r={7}
          fill="var(--tool-but)"
          stroke="var(--tool-but)"
          strokeWidth={1.5}
        />
        <circle cx={228} cy={rowY(0)} r={2.2} fill="var(--bg)" opacity={0.5} />
        <text x={244} y={rowY(0) + 1} className="cg-nodelabel" data-tone="result" textAnchor="start">
          commit
        </text>
        <text x={228} y={rowY(0) + 36} className="cg-col" textAnchor="middle">
          new branch
        </text>

        <text x={8} y={176} className="cg-note">
          one change committed · logging · config · notes stay dirty
        </text>
      </svg>
    </figure>
  );
}

// Multi-amend is about routing: three dirty fixes, each folded into the
// existing commit it belongs to, skipping the ones it does not.
function AmendGraph() {
  const targets = [
    { fix: 'valid.', commit: 'validation' },
    { fix: 'scoring', commit: 'scoring' },
    { fix: 'docs', commit: 'docs' },
  ];
  const targetY = [58, 100, 142];
  const baseY = [79, 121];
  const BRANCH_X = 210;
  return (
    <figure className="commitgraph">
      <svg
        viewBox="0 0 300 204"
        role="img"
        aria-label="Multi-amend: each dirty fix is folded into the existing commit it belongs to; debug and config changes stay uncommitted"
        preserveAspectRatio="xMidYMin meet"
      >
        <text x={10} y={30} className="cg-col">
          dirty fixes
        </text>
        <rect x={4} y={38} width={100} height={124} rx={8} className="cg-box" />

        <text x={BRANCH_X} y={30} className="cg-col" textAnchor="middle">
          branch
        </text>
        <line x1={BRANCH_X} y1={targetY[0]} x2={BRANCH_X} y2={targetY[2]} className="cg-edge" />
        {baseY.map((y) => (
          <circle
            key={y}
            cx={BRANCH_X}
            cy={y}
            r={5}
            fill="var(--surface-2)"
            stroke="var(--border-strong)"
            strokeWidth={1.5}
          />
        ))}

        {targets.map((t, i) => {
          const y = targetY[i];
          return (
            <g key={t.commit}>
              {/* the dirty fix square */}
              <rect
                x={17}
                y={y - 5}
                width={10}
                height={10}
                rx={2}
                fill="var(--tool-but-soft)"
                stroke="var(--tool-but)"
                strokeWidth={1.5}
              />
              <text x={33} y={y + 1} className="cg-nodelabel" data-tone="changed" textAnchor="start">
                {t.fix}
              </text>
              {/* arrow routing it to its commit */}
              <line x1={108} y1={y} x2={198} y2={y} className="cg-arrow" />
              <path d={`M202 ${y} l-7 -4 l0 8 z`} className="cg-arrowhead" />
              {/* the target commit */}
              <circle
                cx={BRANCH_X}
                cy={y}
                r={7}
                fill="var(--tool-but)"
                stroke="var(--tool-but)"
                strokeWidth={1.5}
              />
              <circle cx={BRANCH_X} cy={y} r={2.2} fill="var(--bg)" opacity={0.5} />
              <text
                x={BRANCH_X + 14}
                y={y + 1}
                className="cg-nodelabel"
                data-tone="result"
                textAnchor="start"
              >
                {t.commit}
              </text>
            </g>
          );
        })}

        <text x={8} y={178} className="cg-note">
          each fix amended into the commit it belongs to
        </text>
        <text x={8} y={196} className="cg-leftovers">
          ↳ debug · config notes stay dirty
        </text>
      </svg>
    </figure>
  );
}

export function CommitGraph({ scenario }: { scenario: ScenarioMeta }) {
  if (scenario.shape === 'select') return <SelectGraph />;
  if (scenario.shape === 'amend') return <AmendGraph />;
  const spec = SPECS[scenario.shape];
  const rows = Math.max(spec.before.length, spec.after.length);
  const nodesBottom = TOP + (rows - 1) * GAP;
  const midY = TOP + ((rows - 1) * GAP) / 2;
  const noteY = nodesBottom + 30;
  const leftoversY = noteY + (spec.note ? 18 : 0);
  const height = (spec.leftovers ? leftoversY : spec.note ? noteY : nodesBottom) + 12;
  const arrowX = (COL_BEFORE + COL_AFTER) / 2;

  return (
    <figure className="commitgraph">
      <svg
        viewBox={`0 0 300 ${height}`}
        role="img"
        aria-label={`${scenario.label}: history before and after — ${spec.note ?? ''}`}
        preserveAspectRatio="xMidYMin meet"
      >
        {/* before → after arrow */}
        <line x1={arrowX - 11} y1={midY} x2={arrowX + 7} y2={midY} className="cg-arrow" />
        <path
          d={`M${arrowX + 11} ${midY} l-7 -4 l0 8 z`}
          className="cg-arrowhead"
        />

        <Column nodes={spec.before} x={COL_BEFORE} side="before" />
        <Column nodes={spec.after} x={COL_AFTER} side="after" />

        {spec.note && (
          <text x={8} y={noteY} className="cg-note">
            {spec.note}
          </text>
        )}
        {spec.leftovers && (
          <text x={8} y={leftoversY} className="cg-leftovers">
            ↳ stays uncommitted: {spec.leftovers}
          </text>
        )}
      </svg>
    </figure>
  );
}
