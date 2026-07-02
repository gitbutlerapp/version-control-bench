'use client';

import { useView } from '../state/ViewContext';
import { RESULTS, TOOL_URL } from '../content';
import { AgentCaption, AgentToggle } from './Controls';
import { PassChip } from './Bars';
import { Tooltip } from './Tooltip';
import type { ArmId, Cell, ResultsData } from '@/lib/types';
import { TOOL_VAR, overallCell, scenarioCell } from '@/lib/selectors';
import { count, kb, seconds } from '@/lib/format';

interface Row {
  key: string;
  label: string;
  sid?: string; // scenario id, for scroll-to-detail
  help?: string; // short hover explanation
  overall?: boolean;
  cells: (Cell | undefined)[];
}

// scroll the matching scenario section into view
function openScenario(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// index of the lowest value across the tools (lower is better for time/cmds/kb).
// Pass rate is shown per cell; it does not gate which value counts as best.
function bestIdx(cells: (Cell | undefined)[], get: (c: Cell) => number): number {
  let best = -1;
  let bestVal = Infinity;
  cells.forEach((c, i) => {
    if (!c) return;
    const v = get(c);
    if (v < bestVal) {
      bestVal = v;
      best = i;
    }
  });
  return best;
}

function Group({ cell, best }: { cell: Cell | undefined; best: { t: boolean; c: boolean; k: boolean } }) {
  if (!cell) {
    return (
      <>
        <td className="m-pass">—</td>
        <td className="m-num">—</td>
        <td className="m-num">—</td>
        <td className="m-num">—</td>
      </>
    );
  }
  return (
    <>
      <td className="m-pass">
        <PassChip pass={cell.pass} n={cell.n} size="sm" />
      </td>
      <td className="m-num" data-best={best.t}>
        {seconds(cell.mean_wall_ms)}
        <span className="m-unit">s</span>
      </td>
      <td className="m-num" data-best={best.c}>
        {count(cell.mean_task_vc)}
      </td>
      <td className="m-num" data-best={best.k}>
        {kb(cell.mean_warm_bytes)}
      </td>
    </>
  );
}

export function ResultsTable({ data }: { data: ResultsData }) {
  const { agent } = useView();
  const arms = data.meta.arm_order;
  const armMeta = Object.fromEntries(data.meta.arms.map((a) => [a.id, a]));

  const rows: Row[] = data.meta.scenarios.map((s) => ({
    key: s.id,
    label: s.label,
    sid: s.id,
    help: s.crux,
    cells: arms.map((arm) => scenarioCell(data, s.id, agent, arm)),
  }));
  const overallRow: Row = {
    key: 'all',
    label: 'All scenarios',
    overall: true,
    cells: arms.map((arm) => overallCell(data, agent, arm)),
  };

  const bestsFor = (cells: (Cell | undefined)[]) => ({
    t: bestIdx(cells, (c) => c.mean_wall_ms),
    c: bestIdx(cells, (c) => c.mean_task_vc),
    k: bestIdx(cells, (c) => c.mean_warm_bytes ?? Infinity),
  });

  const renderRow = (row: Row) => {
    const b = bestsFor(row.cells);
    return (
      <tr key={row.key} data-overall={row.overall}>
        <th scope="row" className="m-task">
          {row.sid && row.help ? (
            <Tooltip label={row.help} onActivate={() => openScenario(row.sid!)}>
              {row.label}
            </Tooltip>
          ) : (
            row.label
          )}
        </th>
        {row.cells.map((cell, ai) => (
          <Group
            key={arms[ai]}
            cell={cell}
            best={{ t: b.t === ai, c: b.c === ai, k: b.k === ai }}
          />
        ))}
      </tr>
    );
  };

  return (
    <section id="results">
      <div className="results-head">
        <div className="section-head">
          <p className="eyebrow">{RESULTS.eyebrow}</p>
          <h2>{RESULTS.title}</h2>
        </div>
        <AgentToggle />
      </div>
      <p className="lede">{RESULTS.lede}</p>

      <div className="matrix-wrap">
        <table className="matrix">
          <thead>
            <tr className="matrix-tools">
              <th className="m-corner" rowSpan={2} scope="col">
                Scenario
              </th>
              {arms.map((arm) => (
                <th
                  key={arm}
                  colSpan={4}
                  className="m-tool"
                  style={{ ['--tool' as string]: `var(--tool-${TOOL_VAR[arm as ArmId]})` }}
                >
                  {TOOL_URL[arm] ? (
                    <a
                      className="m-tool-link"
                      href={TOOL_URL[arm]}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {armMeta[arm]?.label ?? arm}
                    </a>
                  ) : (
                    (armMeta[arm]?.label ?? arm)
                  )}
                </th>
              ))}
            </tr>
            <tr className="matrix-metrics">
              {arms.map((arm) => (
                <MetricHeads key={arm} />
              ))}
            </tr>
          </thead>
          <tbody>{rows.map(renderRow)}</tbody>
          <tfoot>{renderRow(overallRow)}</tfoot>
        </table>
      </div>

      <ul className="matrix-legend">
        <li>
          <PassChip pass={5} n={5} size="sm" /> pass rate (reliability first): a wrong history
          fails regardless of speed
        </li>
        <li>
          <span className="legend-bold">bold</span> = best value in each column
        </li>
        <li>KB is comparable within one agent only</li>
      </ul>
      <AgentCaption />
    </section>
  );
}

function MetricHeads() {
  return (
    <>
      <th className="m-h m-h-pass" scope="col">
        <Tooltip label={RESULTS.columns.pass}>pass</Tooltip>
      </th>
      <th className="m-h" scope="col">
        <Tooltip label={RESULTS.columns.time}>time</Tooltip>
      </th>
      <th className="m-h" scope="col">
        <Tooltip label={RESULTS.columns.cmds}>cmds</Tooltip>
      </th>
      <th className="m-h" scope="col">
        <Tooltip label={RESULTS.columns.kb}>KB</Tooltip>
      </th>
    </>
  );
}
