'use client';

import { useView } from '../state/ViewContext';
import { SCENARIOS_INTRO, EYEBROWS, MICRO } from '../content';
import { CommitGraph } from './CommitGraph';
import { PassChip } from './Bars';
import type { ArmId, Cell, ResultsData, ScenarioMeta } from '@/lib/types';
import { TOOL_VAR, scenarioCell } from '@/lib/selectors';
import { count, secondsLabel } from '@/lib/format';

function ToolTable({ data, scenario, agent }: { data: ResultsData; scenario: string; agent: ReturnType<typeof useView>['agent'] }) {
  const armMeta = Object.fromEntries(data.meta.arms.map((a) => [a.id, a]));
  const cells = data.meta.arm_order
    .map((arm) => scenarioCell(data, scenario, agent, arm))
    .filter((c): c is Cell => Boolean(c));
  return (
    <table className="tooltable">
      <thead>
        <tr>
          <th>Tool</th>
          <th className="ta-r">Pass</th>
          <th className="ta-r">Time</th>
          <th className="ta-r">Commands</th>
        </tr>
      </thead>
      <tbody>
        {cells.map((c) => (
          <tr key={c.arm} data-dirty={!c.clean}>
            <td>
              <span
                className="tooltable-tool"
                style={{ ['--tool' as string]: `var(--tool-${TOOL_VAR[c.arm as ArmId]})` }}
              >
                {armMeta[c.arm]?.label ?? c.arm}
              </span>
            </td>
            <td className="ta-r">
              <PassChip pass={c.pass} n={c.n} size="sm" />
            </td>
            <td className="ta-r num">{secondsLabel(c.mean_wall_ms)}</td>
            <td className="ta-r num">{count(c.mean_task_vc)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScenarioCard({
  data,
  scenario,
  index,
}: {
  data: ResultsData;
  scenario: ScenarioMeta;
  index: number;
}) {
  const { agent } = useView();

  return (
    <details className="scenario-card">
      <summary className="scenario-summary">
        <span className="scenario-num mono">{String(index + 1).padStart(2, '0')}</span>
        <span className="scenario-headings">
          <span className="scenario-title">{scenario.title}</span>
          <span className="scenario-situation faint">{scenario.situation}</span>
        </span>
        <span className="scenario-toggle mono" aria-hidden>
          +
        </span>
      </summary>

      <div className="scenario-body">
        <p className="scenario-crux">{scenario.crux}</p>
        <CommitGraph scenario={scenario} />
        <div className="scenario-prompt">
          <span className="eyebrow">{MICRO.promptLabel}</span>
          <blockquote className="mono">{scenario.prompt}</blockquote>
        </div>
        <ToolTable data={data} scenario={scenario.id} agent={agent} />
      </div>
    </details>
  );
}

export function Scenarios({ data }: { data: ResultsData }) {
  return (
    <section id="chores">
      <div className="section-head">
        <p className="eyebrow">{EYEBROWS.scenarios}</p>
        <h2>{SCENARIOS_INTRO.title}</h2>
        <p className="lede">{SCENARIOS_INTRO.lede}</p>
      </div>
      <div className="scenario-grid">
        {data.meta.scenarios.map((s, i) => (
          <ScenarioCard key={s.id} data={data} scenario={s} index={i} />
        ))}
      </div>
    </section>
  );
}
