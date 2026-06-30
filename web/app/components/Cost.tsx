import { COST, EYEBROWS, MICRO } from '../content';
import type { ArmId, Cell, RealAgentId, ResultsData } from '@/lib/types';
import { TOOL_VAR, overallCell } from '@/lib/selectors';
import { kb } from '@/lib/format';

function KbBar({ cell, armLabel, max }: { cell: Cell; armLabel: string; max: number }) {
  const toolVar = TOOL_VAR[cell.arm as ArmId];
  const warm = cell.mean_warm_bytes ?? 0;
  const cold = cell.mean_cold_bytes ?? warm;
  const warmW = max > 0 ? (warm / max) * 100 : 0;
  const coldW = max > 0 ? (cold / max) * 100 : 0;
  const hasOverhead = cold > warm + 1;
  return (
    <div className="kbrow">
      <span className="kbrow-arm" style={{ ['--tool' as string]: `var(--tool-${toolVar})` }}>
        {armLabel}
      </span>
      <div className="kbrow-track">
        {/* cold = warm + skill-read overhead, shown as a ghost extension */}
        <div className="kbseg-cold" style={{ width: `${coldW}%` }} />
        <div
          className="kbseg-warm"
          style={{ width: `${warmW}%`, ['--tool' as string]: `var(--tool-${toolVar})` }}
        />
        <span className="kbrow-value num">
          {kb(warm)}
          {hasOverhead && <span className="kbrow-cold faint"> / {kb(cold)}</span>}
          <span className="faint"> KB</span>
        </span>
      </div>
    </div>
  );
}

function AgentPanel({ data, agent }: { data: ResultsData; agent: RealAgentId }) {
  const armMeta = Object.fromEntries(data.meta.arms.map((a) => [a.id, a]));
  const cells = data.meta.arm_order
    .map((arm) => overallCell(data, agent, arm))
    .filter((c): c is Cell => Boolean(c));
  const max = Math.max(...cells.map((c) => c.mean_cold_bytes ?? c.mean_warm_bytes ?? 0));
  const label = data.meta.agents.find((a) => a.id === agent)?.label ?? agent;
  return (
    <div className="kb-panel">
      <div className="kb-panel-head">
        <span className="eyebrow">within {label}</span>
        <span className="faint mono kb-axis">own scale ↔</span>
      </div>
      <div className="kb-bars">
        {cells.map((c) => (
          <KbBar key={c.arm} cell={c} armLabel={armMeta[c.arm]?.label ?? c.arm} max={max} />
        ))}
      </div>
    </div>
  );
}

export function Cost({ data }: { data: ResultsData }) {
  return (
    <section id="cost">
      <div className="section-head">
        <p className="eyebrow">{EYEBROWS.cost}</p>
        <h2>{COST.title}</h2>
        <p className="lede">{COST.lede}</p>
      </div>

      <div className="callout callout-warn kb-warning" role="note">
        <span className="callout-label eyebrow">{MICRO.kbCalloutLabel}</span>
        <p>{COST.warning}</p>
      </div>

      <div className="kb-fence">
        <AgentPanel data={data} agent="codex" />
        <AgentPanel data={data} agent="claude" />
      </div>

      <p className="kb-legend faint">
        <span className="kb-key">
          <i className="swatch swatch-warm" /> warm — task-only output
        </span>
        <span className="kb-key">
          <i className="swatch swatch-cold" /> cold — raw total incl. skill reads
        </span>
      </p>
      <p className="kb-note faint">{COST.note}</p>
    </section>
  );
}
