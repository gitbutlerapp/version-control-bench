'use client';

import { useView } from '../state/ViewContext';
import { SCORECARD, METRIC_LABELS, EYEBROWS, MICRO } from '../content';
import { AgentCaption } from './Controls';
import { BarRow } from './Bars';
import type { Cell, ResultsData } from '@/lib/types';
import { metricValue, overallCell } from '@/lib/selectors';

const FAIRNESS = [
  'same prompt, tool name hidden',
  'hidden git-state grader',
  'setup excluded from timing',
  'jj: colocated repo + external skill',
];

export function Scorecard({ data }: { data: ResultsData }) {
  const { agent, metric } = useView();
  const armMeta = Object.fromEntries(data.meta.arms.map((a) => [a.id, a]));
  const cells = data.meta.arm_order
    .map((arm) => overallCell(data, agent, arm))
    .filter((c): c is Cell => Boolean(c));
  const max = Math.max(...cells.map((c) => metricValue(c, metric)));

  return (
    <section id="scorecard">
      <div className="section-head">
        <p className="eyebrow">{EYEBROWS.proof}</p>
        <h2>{SCORECARD.title}</h2>
        <p className="lede">{SCORECARD.lede}</p>
      </div>

      <AgentCaption />

      <div className="scorecard-panel">
        <div className="scorecard-metrichead">
          <span className="eyebrow">{METRIC_LABELS[metric].label}</span>
          <span className="faint mono scorecard-sub">
            {METRIC_LABELS[metric].sub} · {MICRO.lowerIsBetter}
          </span>
        </div>
        <div className="scorecard-bars">
          {cells.map((c) => (
            <BarRow
              key={c.arm}
              cell={c}
              armLabel={armMeta[c.arm]?.label ?? c.arm}
              metric={metric}
              max={max}
            />
          ))}
        </div>
        <p className="scorecard-gate">
          <span className="gate-mark" aria-hidden>
            ▲
          </span>{' '}
          {SCORECARD.gateNote}
        </p>
      </div>

      <ul className="fairness-strip" aria-label="Fairness controls">
        {FAIRNESS.map((f) => (
          <li key={f}>
            <a href="#method">{f}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
