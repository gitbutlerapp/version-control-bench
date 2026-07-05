import { LEDGER, EYEBROWS } from '../content';
import type { ArmId, Cell, ResultsData } from '@/lib/types';
import { TOOL_VAR } from '@/lib/selectors';

interface LedgerRow {
  arm: ArmId;
  agent: string;
  scenario: string;
  failure: string;
  count: number;
  severity: string;
  read: string;
  groupStart?: boolean;
}

// Build the ledger from the per-scenario cells, in plain tool order.
function buildRows(data: ResultsData): LedgerRow[] {
  const order: ArmId[] = ['git', 'jj+skill', 'but+skill'];
  const scenarioLabel = Object.fromEntries(
    data.meta.scenarios.map((s) => [s.id, s.label]),
  );
  const rows: LedgerRow[] = [];
  for (const arm of order) {
    for (const agent of ['codex', 'claude'] as const) {
      const cells = data.cells_by_scenario.filter(
        (c) => c.agent === agent && c.arm === arm && (c.failures?.length ?? 0) > 0,
      );
      for (const c of cells as Cell[]) {
        for (const f of c.failures ?? []) {
          rows.push({
            arm,
            agent,
            scenario: scenarioLabel[c.scenario ?? ''] ?? c.scenario ?? '',
            failure: f.failure,
            count: f.count,
            severity: f.severity,
            read: f.read,
          });
        }
      }
    }
  }
  // mark tool-group boundaries so the table can articulate them
  rows.forEach((r, i) => {
    if (i > 0 && r.arm !== rows[i - 1].arm) r.groupStart = true;
  });
  return rows;
}

// One-line summary derived from the data, so it tracks each batch.
function ledgerLede(data: ResultsData, failed: number): string {
  const m = data.meta;
  if (failed === 0) return LEDGER.emptyLede;
  const armMisses = ['git', 'jj+skill', 'but+skill']
    .map((arm) => {
      const n = data.cells_by_scenario
        .filter((c) => c.arm === arm && c.agent !== 'both')
        .reduce((s, c) => s + (c.failures?.reduce((a, f) => a + f.count, 0) ?? 0), 0);
      const label = m.arms.find((a) => a.id === arm)?.label ?? arm;
      return n === 0 ? `${label} none` : `${label} ${n}`;
    })
    .join(', ');
  return `${failed} of ${m.total_runs} runs failed the grader (${armMisses}).`;
}

export function FailureLedger({ data }: { data: ResultsData }) {
  const rows = buildRows(data);
  const armLabel = Object.fromEntries(data.meta.arms.map((a) => [a.id, a.label]));
  const failed = data.meta.total_runs - data.meta.total_passed;

  return (
    <section id="failures">
      <div className="section-head">
        <p className="eyebrow">{EYEBROWS.failures}</p>
        <h2>{LEDGER.title}</h2>
        <p className="lede">{ledgerLede(data, failed)}</p>
      </div>

      <div className="ledger-wrap">
        <table className="ledger">
        <thead>
          <tr>
            <th>Tool</th>
            <th>Agent</th>
            <th>Scenario</th>
            <th>Failure</th>
            <th className="ta-r">Runs</th>
            <th>What went wrong</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} data-severity={r.severity} data-group-start={r.groupStart || undefined}>
              <td>
                <span
                  className="ledger-tool"
                  style={{ ['--tool' as string]: `var(--tool-${TOOL_VAR[r.arm]})` }}
                >
                  {armLabel[r.arm]}
                </span>
              </td>
              <td className="mono">{r.agent}</td>
              <td>{r.scenario}</td>
              <td>
                <span className="ledger-class mono" data-severity={r.severity}>
                  {r.failure}
                </span>
              </td>
              <td className="ta-r num">
                {r.count}/{data.meta.k}
              </td>
              <td className="muted">{r.read}</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </section>
  );
}
