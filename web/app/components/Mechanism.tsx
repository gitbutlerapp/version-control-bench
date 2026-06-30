'use client';

import { useView } from '../state/ViewContext';
import { MECHANISM, EYEBROWS } from '../content';
import type { ArmId, Cell, ResultsData } from '@/lib/types';
import { TOOL_VAR } from '@/lib/selectors';
import { overallCell } from '@/lib/selectors';
import { count } from '@/lib/format';

function CommandBar({ cell, armLabel, max }: { cell: Cell; armLabel: string; max: number }) {
  const toolVar = TOOL_VAR[cell.arm as ArmId];
  const total = cell.mean_task_vc;
  const inspectW = (cell.mean_inspect / max) * 100;
  const mutateW = (cell.mean_mutate / max) * 100;
  return (
    <div className="cmdrow">
      <span className="cmdrow-arm" style={{ ['--tool' as string]: `var(--tool-${toolVar})` }}>
        {armLabel}
      </span>
      <div className="cmdrow-track">
        <div
          className="cmdseg cmdseg-inspect"
          style={{ width: `${inspectW}%`, ['--tool' as string]: `var(--tool-${toolVar})` }}
          title={`inspect ≈ ${count(cell.mean_inspect)}`}
        />
        <div
          className="cmdseg cmdseg-mutate"
          style={{ width: `${mutateW}%`, ['--tool' as string]: `var(--tool-${toolVar})` }}
          title={`mutate ≈ ${count(cell.mean_mutate)}`}
        />
        <span className="cmdrow-total num">{count(total)}</span>
      </div>
    </div>
  );
}

export function Mechanism({ data }: { data: ResultsData }) {
  const { agent } = useView();
  const armMeta = Object.fromEntries(data.meta.arms.map((a) => [a.id, a]));
  const cells = data.meta.arm_order
    .map((arm) => overallCell(data, agent, arm))
    .filter((c): c is Cell => Boolean(c));
  const max = Math.max(...cells.map((c) => c.mean_task_vc));

  return (
    <section id="why">
      <div className="section-head">
        <p className="eyebrow">{EYEBROWS.mechanism}</p>
        <h2>{MECHANISM.title}</h2>
        <p className="lede">{MECHANISM.lede}</p>
      </div>

      <div className="cmd-panel">
        <div className="cmd-legend mono faint">
          <span>
            <i className="swatch swatch-inspect" /> inspect (status / log / diff)
          </span>
          <span>
            <i className="swatch swatch-mutate" /> mutate (commit / amend / rebase)
          </span>
        </div>
        <div className="cmd-bars">
          {cells.map((c) => (
            <CommandBar key={c.arm} cell={c} armLabel={armMeta[c.arm]?.label ?? c.arm} max={max} />
          ))}
        </div>
        <p className="cmd-note faint">{MECHANISM.approxNote}</p>
      </div>
    </section>
  );
}
