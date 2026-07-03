import rawData from '../../data/results.json';
import type { ResultsData } from '@/lib/types';
import { HERO, METHOD, REPO_URL, taskDefUrl } from '../content';

const data = rawData as unknown as ResultsData;

export const dynamic = 'force-static';

// A markdown summary for agents that would rather not parse the HTML.
// Rendered from the same data as the page so it cannot drift.
export function GET() {
  const m = data.meta;

  const passByArm = m.arm_order.map((arm) => {
    // skip the precomputed 'both' aggregate cells or every run counts twice
    const cells = data.cells_by_scenario.filter(
      (c) => c.arm === arm && c.agent !== 'both',
    );
    const pass = cells.reduce((sum, c) => sum + c.pass, 0);
    const n = cells.reduce((sum, c) => sum + c.n, 0);
    const label = m.arms.find((a) => a.id === arm)?.label ?? arm;
    return `- ${label}: ${pass}/${n} runs passed`;
  });

  const scenarios = m.scenarios.map(
    (s) => `- [${s.label}](${taskDefUrl(s.id)}): ${s.situation}`,
  );

  const md = [
    `# ${HERO.title}`,
    '',
    `> ${HERO.intro.join(' ')}`,
    '',
    `Latest data: ${m.snapshot_date}. ${m.total_runs} graded runs (k=${m.k} per agent-tool-scenario cell), ${m.total_passed} passed.`,
    '',
    '## Grader pass rate by tool, both agents combined',
    '',
    ...passByArm,
    '',
    '## Scenarios',
    '',
    ...scenarios,
    '',
    '## Method',
    '',
    METHOD.lede,
    '',
    '## Data and definitions',
    '',
    `- [Benchmark repository](${REPO_URL})`,
    `- [Full results JSON](${REPO_URL}/blob/main/web/data/results.json)`,
    `- [Task definitions](${REPO_URL}/tree/main/tasks)`,
    '',
  ].join('\n');

  return new Response(md, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
