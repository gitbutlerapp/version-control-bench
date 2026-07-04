// Shape of web/data/results.json (produced by scripts/build-web-data.mjs).

export type AgentId = 'codex' | 'claude' | 'both';
export type RealAgentId = 'codex' | 'claude';
export type ArmId = 'git' | 'jj+skill' | 'but+skill';
export type MetricId = 'time' | 'ops';

export interface VsGit {
  time_pct: number;
  time_speedup: number;
  ops_pct: number;
  ops_ratio: number;
  passrate_delta: number;
  kb_pct: number | null;
}

export interface Failure {
  failure: string;
  count: number;
  severity: 'near-miss' | 'worse-miss' | 'unknown';
  read: string;
}

// Mean paired per-scenario difference vs the same agent's git arm, with a
// t-based 95% CI over scenarios (lo/hi null when only one scenario).
export interface PairedStat {
  mean: number;
  lo: number | null;
  hi: number | null;
  n: number;
}

export interface PairedVsGit {
  pass_rate_pp: PairedStat | null;
  wall_ms: PairedStat | null;
  task_vc: PairedStat | null;
}

export interface Cell {
  agent: AgentId;
  arm: ArmId;
  scenario?: string;
  n: number;
  pass: number;
  pass_rate: number;
  pass_ci_lo: number | null;
  pass_ci_hi: number | null;
  clean: boolean;
  // overall cells only
  task_count?: number;
  tasks_all_pass?: number;
  paired_vs_git?: PairedVsGit | null;
  mean_wall_ms: number;
  median_wall_ms: number | null;
  max_wall_ms: number;
  mean_task_vc: number;
  mean_inspect: number;
  mean_mutate: number;
  mean_cold_bytes: number | null;
  mean_warm_bytes: number | null;
  failures?: Failure[];
  vs_git: VsGit | null;
}

export interface ScenarioMeta {
  id: string;
  label: string;
  title: string;
  situation: string;
  crux: string;
  shape: 'select' | 'amend' | 'split' | 'reorder' | 'squash';
  prompt: string;
}

export interface ArmMeta {
  id: ArmId;
  label: string;
  short: string;
  is_baseline?: boolean;
  vendor?: string;
  vendor_bias?: boolean;
  blurb?: string;
}

export interface AgentMeta {
  id: AgentId;
  label: string;
  observed_model?: string | null;
  note?: string;
}

export interface SourceSnapshot {
  batch: string;
  arms: string[];
  generated_at: string;
  runs: number;
  provenance: Record<string, string | null>;
}

export interface ResultsData {
  schema_version: number;
  generated_at: string;
  meta: {
    k: number;
    total_runs: number;
    total_passed: number;
    pass_rate: number;
    snapshot_date: string;
    agents: AgentMeta[];
    arms: ArmMeta[];
    arm_order: ArmId[];
    scenarios: ScenarioMeta[];
    comparability: Record<string, { cross_agent: boolean; within_agent: boolean }>;
    kb_comparable_within_agent_only: boolean;
    kb_note: string;
    stats_note: string;
    generator: string;
  };
  source_snapshots: SourceSnapshot[];
  cells_overall: Cell[];
  cells_by_scenario: Cell[];
  rows: unknown[];
}
