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
// Drives the generic before|after stack renderer for the history-shape
// scenarios. select and amend have their own bespoke components below.
const SPECS: Record<'split' | 'reorder' | 'squash' | 'update', GraphSpec> = {
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
    note: 'two groups squashed · two commits kept',
  },
  update: {
    before: [
      { label: 'feature 2', tone: 'changed' },
      { label: 'feature 1', tone: 'changed' },
      { label: 'old main' },
    ],
    after: [
      { label: 'feature 2′', tone: 'result' },
      { label: 'feature 1′', tone: 'result' },
      { label: 'main +2' },
      { label: 'main +1' },
      { label: 'old main' },
    ],
    note: 'rebuilt on new main · conflicts resolved',
    leftovers: 'README edit · rollout note',
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

// Selective commit is a partition, not a history rewrite: the validation work
// (spread across three files) becomes one commit on a new branch, the rest stays
// dirty. src/handler.ts straddles the split, so its hunks are drawn individually
// — two committed, one left behind — to show a single file on both sides.
const SELECT_IN = { fill: 'var(--tool-but-soft)', stroke: 'var(--tool-but)' };
const SELECT_OUT = { fill: 'none', stroke: 'var(--border-strong)' };

function SelectGraph() {
  const files = [
    { name: 'handler.ts', hunks: ['in', 'in', 'out'] },
    { name: 'handler.test', hunks: ['in'] },
    { name: 'README', hunks: ['in'] },
    { name: 'config.ts', hunks: ['out'] },
    { name: 'notes', hunks: ['out'], untracked: true },
  ];
  const rowY = (i: number) => 48 + i * 27;
  const CELL = 11;
  const GAPC = 3;
  const RIGHT = 174;
  const midY = rowY(1); // centre of the committed rows (0..2)
  return (
    <figure className="commitgraph">
      <svg
        viewBox="0 0 300 180"
        role="img"
        aria-label="Selective commit: two validation hunks in handler.ts plus the test and README become one commit on a new branch; a logging hunk in handler.ts, the config change, and untracked notes stay uncommitted."
        preserveAspectRatio="xMidYMin meet"
      >
        <text x={12} y={16} className="cg-col">
          dirty worktree
        </text>
        <rect x={4} y={32} width={182} height={140} rx={8} className="cg-box" />
        {files.map((f, i) => {
          const y = rowY(i);
          const n = f.hunks.length;
          const startX = RIGHT - (n * CELL + (n - 1) * GAPC);
          return (
            <g key={f.name}>
              <text x={14} y={y + 1} className="cg-nodelabel" data-tone="base" textAnchor="start">
                {f.name}
              </text>
              {f.hunks.map((h, j) => {
                const c = h === 'in' ? SELECT_IN : SELECT_OUT;
                return (
                  <rect
                    key={j}
                    x={startX + j * (CELL + GAPC)}
                    y={y - CELL / 2}
                    width={CELL}
                    height={CELL}
                    rx={2}
                    fill={c.fill}
                    stroke={c.stroke}
                    strokeWidth={1.5}
                    strokeDasharray={f.untracked ? '3 2' : undefined}
                  />
                );
              })}
            </g>
          );
        })}

        {/* the committed hunks collapse into one commit on a new branch */}
        <line x1={190} y1={midY} x2={232} y2={midY} className="cg-arrow" />
        <path d={`M236 ${midY} l-7 -4 l0 8 z`} className="cg-arrowhead" />
        <circle cx={254} cy={midY} r={8} fill="var(--tool-but)" stroke="var(--tool-but)" strokeWidth={1.5} />
        <circle cx={254} cy={midY} r={2.4} fill="var(--bg)" opacity={0.5} />
        <text x={254} y={midY - 15} className="cg-col" textAnchor="middle">
          1 commit
        </text>
        <text x={254} y={midY + 24} className="cg-col" textAnchor="middle">
          new branch
        </text>
      </svg>
      <figcaption className="cg-caption">
        amber hunks → one commit · hollow stays uncommitted
      </figcaption>
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
        viewBox="0 0 300 168"
        role="img"
        aria-label="Multi-amend: each dirty fix is folded into the existing commit it belongs to; debug and config changes stay uncommitted"
        preserveAspectRatio="xMidYMin meet"
      >
        <text x={10} y={16} className="cg-col">
          dirty fixes
        </text>
        <rect x={4} y={38} width={100} height={124} rx={8} className="cg-box" />

        <text x={BRANCH_X} y={16} className="cg-col" textAnchor="middle">
          branch
        </text>
        <line x1={BRANCH_X} y1={targetY[0]} x2={BRANCH_X} y2={targetY[2]} className="cg-edge" />
        {baseY.map((y) => (
          <circle
            key={y}
            cx={BRANCH_X}
            cy={y}
            r={R}
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
              <line x1={108} y1={y} x2={196} y2={y} className="cg-arrow" />
              <path d={`M200 ${y} l-7 -4 l0 8 z`} className="cg-arrowhead" />
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

      </svg>
      <figcaption className="cg-caption">
        each fix amended into its commit
        <br />↳ debug · config notes stay dirty
      </figcaption>
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
  const height = nodesBottom + 16;
  const arrowX = (COL_BEFORE + COL_AFTER) / 2;

  return (
    <figure className="commitgraph">
      <svg
        viewBox={`0 0 300 ${height}`}
        role="img"
        aria-label={`${scenario.label}: history before and after${spec.note ? `, ${spec.note}` : ''}`}
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
      </svg>
      {(spec.note || spec.leftovers) && (
        <figcaption className="cg-caption">
          {spec.note}
          {spec.leftovers && (
            <>
              <br />↳ stays uncommitted: {spec.leftovers}
            </>
          )}
        </figcaption>
      )}
    </figure>
  );
}
