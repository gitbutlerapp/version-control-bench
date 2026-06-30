import type { ArmId, Cell, MetricId } from '@/lib/types';
import { TOOL_VAR } from '@/lib/selectors';
import { count, passFraction, secondsLabel } from '@/lib/format';

export function PassChip({ pass, n, size = 'md' }: { pass: number; n: number; size?: 'sm' | 'md' }) {
  const clean = pass === n;
  const zero = pass === 0;
  const status = clean ? 'pass' : zero ? 'fail' : 'warn';
  const glyph = clean ? '✓' : zero ? '✕' : '!';
  return (
    <span className="passchip num" data-status={status} data-size={size}>
      <span className="passchip-glyph" aria-hidden>
        {glyph}
      </span>
      <span>{passFraction(pass, n)}</span>
      <span className="sr-only">{clean ? 'all runs passed' : `${pass} of ${n} runs passed`}</span>
    </span>
  );
}

interface BarRowProps {
  cell: Cell;
  armLabel: string;
  metric: MetricId;
  max: number;
}

// A single tool's row: pass chip (left, weighted) + a bar whose length is the
// metric value. Shorter is better (less time / fewer commands). Non-clean cells
// are defaced so a fast-but-wrong result can never read as a win.
export function BarRow({ cell, armLabel, metric, max }: BarRowProps) {
  const value = metric === 'time' ? cell.mean_wall_ms : cell.mean_task_vc;
  const label = metric === 'time' ? secondsLabel(cell.mean_wall_ms) : count(cell.mean_task_vc);
  const pctW = max > 0 ? Math.max((value / max) * 100, 1.5) : 0;
  const toolVar = TOOL_VAR[cell.arm as ArmId];
  const zero = cell.pass === 0;
  const dirty = !cell.clean;

  // median notch (time only): where the median sits along this bar's own length
  const notch =
    metric === 'time' && cell.median_wall_ms != null && cell.mean_wall_ms > 0
      ? Math.min((cell.median_wall_ms / cell.mean_wall_ms) * pctW, pctW)
      : null;

  return (
    <div className="barrow" data-dirty={dirty} data-zero={zero}>
      <div className="barrow-head">
        <PassChip pass={cell.pass} n={cell.n} size="sm" />
        <span className="barrow-arm" style={{ ['--tool' as string]: `var(--tool-${toolVar})` }}>
          {armLabel}
        </span>
      </div>
      <div className="barrow-track" style={{ ['--tool' as string]: `var(--tool-${toolVar})` }}>
        <div
          className="barrow-fill"
          style={{ width: `${pctW}%` }}
          data-dirty={dirty}
          data-zero={zero}
        />
        {notch != null && (
          <span
            className="barrow-notch"
            style={{ left: `${notch}%` }}
            title={`median ${secondsLabel(cell.median_wall_ms)}`}
          />
        )}
        <span className="barrow-value num">
          {zero ? `(${label})` : label}
        </span>
      </div>
    </div>
  );
}
