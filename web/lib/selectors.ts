import type { AgentId, ArmId, Cell, MetricId, ResultsData } from './types';

export const TOOL_COLOR: Record<ArmId, string> = {
  git: 'var(--tool-git)',
  'jj+skill': 'var(--tool-jj)',
  'but+skill': 'var(--tool-but)',
};
export const TOOL_SOFT: Record<ArmId, string> = {
  git: 'var(--tool-git-soft)',
  'jj+skill': 'var(--tool-jj-soft)',
  'but+skill': 'var(--tool-but-soft)',
};
export const TOOL_VAR: Record<ArmId, string> = {
  git: 'git',
  'jj+skill': 'jj',
  'but+skill': 'but',
};

export function overallCell(data: ResultsData, agent: AgentId, arm: ArmId): Cell | undefined {
  return data.cells_overall.find((c) => c.agent === agent && c.arm === arm);
}

export function scenarioCell(
  data: ResultsData,
  scenario: string,
  agent: AgentId,
  arm: ArmId,
): Cell | undefined {
  return data.cells_by_scenario.find(
    (c) => c.scenario === scenario && c.agent === agent && c.arm === arm,
  );
}

export function metricValue(cell: Cell, metric: MetricId): number {
  return metric === 'time' ? cell.mean_wall_ms : cell.mean_task_vc;
}

// The "winner" for a scenario, computed correctness-first: among the tools that
// passed every run (clean) for this agent, the fastest. Never speed alone.
export function winningArm(
  data: ResultsData,
  scenario: string,
  agent: AgentId,
): { arm: ArmId; contested: boolean } | null {
  const cells = data.meta.arm_order
    .map((arm) => scenarioCell(data, scenario, agent, arm))
    .filter((c): c is Cell => Boolean(c));
  const clean = cells.filter((c) => c.clean);
  if (clean.length === 0) return null;
  const best = clean.reduce((a, b) => (b.mean_wall_ms < a.mean_wall_ms ? b : a));
  // contested if a *faster* tool exists but failed the gate (worth flagging)
  const fasterButDirty = cells.some((c) => !c.clean && c.mean_wall_ms < best.mean_wall_ms);
  return { arm: best.arm, contested: fasterButDirty };
}

export function isCrossAgentComparable(metric: MetricId): boolean {
  return metric === 'time' || metric === 'ops';
}
