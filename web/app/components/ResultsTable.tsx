'use client';

import { Fragment, useState } from 'react';
import { useView } from '../state/ViewContext';
import { RESULTS, TOOL_URL } from '../content';
import { AgentCaption, AgentToggle } from './Controls';
import { PassChip } from './Bars';
import { RunStrip } from './RunStrip';
import { Tooltip } from './Tooltip';
import type { ArmId, Cell, ResultsData } from '@/lib/types';
import { TOOL_VAR, overallCell, scenarioCell } from '@/lib/selectors';
import { count, kb, pairedRange, seconds, secondsLabel } from '@/lib/format';

interface Row {
  key: string;
  label: string;
  sid?: string; // scenario id; scenario rows are expandable
  help?: string; // short hover explanation (the crux)
  overall?: boolean;
  cells: (Cell | undefined)[];
}

// jump to the failures table (from a pass chip that has a miss)
function scrollToFailures() {
  document.getElementById('failures')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        <td className="m-pass">–</td>
        <td className="m-num">–</td>
        <td className="m-num">–</td>
        <td className="m-num">–</td>
      </>
    );
  }
  return (
    <>
      <td className="m-pass">
        <PassChip
          pass={cell.pass}
          n={cell.n}
          ciLo={cell.pass_ci_lo}
          ciHi={cell.pass_ci_hi}
          size="sm"
          onActivate={cell.pass < cell.n ? scrollToFailures : undefined}
        />
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

  // Expandable scenario rows: clicking a scenario drops its per-run wall-time
  // distribution inline, pushing the rows below down. Complexity on demand —
  // the matrix stays scannable until you open a row.
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());
  const toggle = (sid: string) =>
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  const colSpan = 1 + arms.length * 4;

  // Phone rendering: the wide table needs sideways scrolling that hides two of
  // the three tools, so under 640px each scenario becomes a card with tools as
  // rows and metrics as columns — the tool comparison fits the screen whole.
  // Which of the two renders is shown is a pure CSS media query.
  const renderCard = (row: Row) => {
    const b = bestsFor(row.cells);
    const isOpen = row.sid ? openSet.has(row.sid) : false;
    return (
      <section className="mcard" key={row.key} data-overall={row.overall || undefined}>
        {row.sid ? (
          <button
            type="button"
            className="m-expand mcard-head"
            aria-expanded={isOpen}
            onClick={() => toggle(row.sid!)}
          >
            <span className="m-caret" data-open={isOpen} aria-hidden>
              ▸
            </span>
            <span>{row.label}</span>
          </button>
        ) : (
          <p className="mcard-head">{row.label}</p>
        )}
        <table className="mcard-table">
          <thead>
            <tr>
              <th />
              <th scope="col">pass</th>
              <th scope="col">time</th>
              <th scope="col">cmds</th>
              <th scope="col">KB</th>
            </tr>
          </thead>
          <tbody>
            {row.cells.map((cell, ai) => {
              const arm = arms[ai];
              return (
                <tr key={arm}>
                  <th scope="row">
                    <span
                      className="mcard-tool"
                      style={{ ['--tool' as string]: `var(--tool-${TOOL_VAR[arm as ArmId]})` }}
                    >
                      {armMeta[arm]?.label ?? arm}
                    </span>
                  </th>
                  {cell ? (
                    <>
                      <td className="mcard-pass">
                        <PassChip
                          pass={cell.pass}
                          n={cell.n}
                          ciLo={cell.pass_ci_lo}
                          ciHi={cell.pass_ci_hi}
                          size="sm"
                        />
                      </td>
                      <td data-best={b.t === ai}>
                        {seconds(cell.mean_wall_ms)}
                        <span className="m-unit">s</span>
                      </td>
                      <td data-best={b.c === ai}>{count(cell.mean_task_vc)}</td>
                      <td data-best={b.k === ai}>{kb(cell.mean_warm_bytes)}</td>
                    </>
                  ) : (
                    <>
                      <td>–</td>
                      <td>–</td>
                      <td>–</td>
                      <td>–</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {isOpen && row.sid && <RunStrip data={data} scenarioId={row.sid} />}
      </section>
    );
  };

  const renderRow = (row: Row, isOpen = false) => {
    const b = bestsFor(row.cells);
    return (
      <tr key={row.key} data-overall={row.overall} data-open={isOpen || undefined}>
        <th scope="row" className="m-task">
          {row.sid ? (
            <button
              type="button"
              className="m-expand"
              aria-expanded={isOpen}
              aria-controls={`detail-${row.sid}`}
              title={row.help}
              onClick={() => toggle(row.sid!)}
            >
              <span className="m-caret" data-open={isOpen} aria-hidden>
                ▸
              </span>
              <span>{row.label}</span>
            </button>
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
          <tbody>
            {rows.map((row) => {
              const isOpen = openSet.has(row.key);
              return (
                <Fragment key={row.key}>
                  {renderRow(row, isOpen)}
                  {isOpen && row.sid && (
                    <tr className="matrix-detail" id={`detail-${row.sid}`}>
                      <td colSpan={colSpan}>
                        {/* sticky inner keeps the strip inside the scroller's
                            viewport when the table itself scrolls sideways */}
                        <div className="matrix-detail-inner">
                          <RunStrip data={data} scenarioId={row.sid} />
                          <a className="matrix-detail-link mono" href={`#${row.sid}`}>
                            full scenario ↗
                          </a>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>{renderRow(overallRow)}</tfoot>
        </table>
      </div>

      <div className="matrix-cards">{[...rows, overallRow].map(renderCard)}</div>

      <ul className="matrix-legend">
        <li>
          <PassChip pass={5} n={5} size="sm" /> pass rate: a wrong history fails, no matter how
          fast
        </li>
        <li>
          <span className="legend-bold">bold</span> = best of the three tools
        </li>
        <li>click a scenario to see its per-run times</li>
        <li>hover a pass chip for its Wilson 95% interval</li>
        <li>KB is comparable within one agent only</li>
      </ul>
      <StatisticalRead data={data} />
      <AgentCaption />
    </section>
  );
}

// The task-clustered read of the overall row: mean paired per-scenario deltas
// vs the same agent's git arm with 95% CIs. This is the honest version of the
// headline percentages — with a small scenario set most intervals cross zero, and
// saying so on the page beats a critic saying it first.
function StatisticalRead({ data }: { data: ResultsData }) {
  const { agent } = useView();
  const armMeta = Object.fromEntries(data.meta.arms.map((a) => [a.id, a]));
  const comparisonArms = data.meta.arm_order.filter((arm) => arm !== 'git');
  const allK = data.meta.arm_order
    .map((arm) => {
      const c = overallCell(data, agent, arm);
      return c ? `${armMeta[arm]?.label ?? arm} ${c.tasks_all_pass}/${c.task_count}` : null;
    })
    .filter(Boolean)
    .join(' · ');

  return (
    <details className="stat-read">
      <summary>Statistical read: paired per-scenario deltas vs git (95% CI)</summary>
      <p>
        Scenarios where every run passed (the reliability gate): <span className="num">{allK}</span>
      </p>
      <ul>
        {comparisonArms.map((arm) => {
          const paired = overallCell(data, agent, arm)?.paired_vs_git;
          if (!paired) return null;
          return (
            <li key={arm}>
              <strong>{armMeta[arm]?.label ?? arm}</strong>: wall{' '}
              <span className="num">{pairedRange(paired.wall_ms, (v) => secondsLabel(v))}</span> ·
              commands <span className="num">{pairedRange(paired.task_vc, (v) => count(v))}</span>{' '}
              · pass rate{' '}
              <span className="num">
                {pairedRange(paired.pass_rate_pp, (v) => `${Math.round(v * 10) / 10}pp`)}
              </span>{' '}
              <span className="faint">over {paired.wall_ms?.n ?? 0} scenarios</span>
            </li>
          );
        })}
      </ul>
      <p className="faint">
        Each scenario contributes one paired difference; intervals are t-based with df = scenarios
        − 1. An interval crossing zero means the effect is not established on this scenario set.
      </p>
    </details>
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
