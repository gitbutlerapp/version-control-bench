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
  return rows;
}

export function FailureLedger({ data }: { data: ResultsData }) {
  const rows = buildRows(data);
  const armLabel = Object.fromEntries(data.meta.arms.map((a) => [a.id, a.label]));

  return (
    <section id="failures">
      <div className="section-head">
        <p className="eyebrow">{EYEBROWS.failures}</p>
        <h2>{LEDGER.title}</h2>
        <p className="lede">{LEDGER.lede}</p>
      </div>

      <table className="ledger">
        <thead>
          <tr>
            <th>Tool</th>
            <th>Agent</th>
            <th>Task</th>
            <th>Failure</th>
            <th className="ta-r">Runs</th>
            <th>What went wrong</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} data-severity={r.severity}>
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
                {r.count}/5
              </td>
              <td className="faint">{r.read}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ledger-defs">
        {LEDGER.defs.map((d) => (
          <div key={d.term}>
            <dt className="mono">{d.term}</dt>
            <dd className="faint">{d.read}</dd>
          </div>
        ))}
      </dl>

      <p className="prose ledger-proportion">{LEDGER.proportionality}</p>
    </section>
  );
}
