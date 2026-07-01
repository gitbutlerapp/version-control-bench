#!/usr/bin/env node
// Derive the committed web/data/results.json from raw aggregate.json benchmark
// snapshots (which live under the gitignored tmp/ dir).
//
// This script is the honesty firewall for the results page. It precomputes the
// correctness gate, within-agent deltas, and per-scenario failures, and it
// NEVER emits a cross-agent KB series (Claude and Codex transcript bytes use
// different formats and are not comparable). The UI keys all winner styling off
// the precomputed `clean`/`pass_rate` fields, never off speed.
//
// Usage:
//   node scripts/build-web-data.mjs
//   node scripts/build-web-data.mjs --aggregate <path> --out <path>
//   node scripts/build-web-data.mjs --baseline <path> --jj <path> --out <path>
//
// Re-run after a new benchmark batch (edit DEFAULTS or pass --aggregate),
// then commit web/data/results.json.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');

// ---- source snapshots (the "current value") -------------------------------
const DEFAULTS = {
  aggregate: 'tmp/pilot-runs/full-k5-20260701-all-tools/aggregate.json',
  baseline: null, // legacy: git + but+skill
  jj: null, // legacy: jj+skill
  out: 'web/data/results.json',
};

function parseArgs(argv) {
  const out = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i]?.replace(/^--/, '');
    if (k && k in out) {
      out[k] = argv[i + 1];
      if (k === 'baseline' || k === 'jj') out.aggregate = null;
    }
  }
  return out;
}

// ---- scenario metadata -----------------------------------------------------
// label + reader-facing prompt come from the task packages so the page stays in
// sync with what the agents actually saw. `situation` is the "imagine when this
// applies to you" hook; `shape` drives the before/after commit-graph sketch.
const SCENARIOS = [
  {
    id: 'pilot-1-selective-validation',
    label: 'Selective commit',
    title: 'Commit just one thing, leave the rest alone',
    situation:
      'You sat down to fix input validation and also poked at logging, tweaked some config, and left a couple of debug notes. You want a clean branch with only the validation work committed — everything else still sitting in your worktree, untouched.',
    crux: "The hard part isn't committing. It's committing only the right files and hunks, and not the rest of the dirty worktree.",
    shape: 'select',
  },
  {
    id: 'pilot-2-multi-amend',
    label: 'Multi-amend',
    title: 'Fold each fix into the commit it belongs to',
    situation:
      "Review came back and you've got three small fixes sitting dirty in your tree: one belongs in the validation commit, one in the scoring commit, one in the docs commit. You don't want a “misc review fixes” commit — you want each change folded back into the commit it actually fixes.",
    crux: 'Each fix has to land in a different existing commit, not in one new catch-all commit.',
    shape: 'amend',
  },
  {
    id: 'pilot-3-split-commit',
    label: 'Split commit',
    title: 'Split one overloaded commit into clean ones',
    situation:
      "There's a commit halfway down your branch doing too much — it mixes validation, scoring, and docs, plus stray debug work that should never have been there. You want to break it into three clean, ordered commits, keep the later commit on top exactly where it is, and turn the stray work back into uncommitted changes.",
    crux: 'Rewriting a commit that is not on top, without disturbing what is above it.',
    shape: 'split',
  },
  {
    id: 'pilot-4-reorder-commits',
    label: 'Reorder commits',
    title: 'Reorder commits so the story reads right',
    situation:
      'The branch is correct and the tests pass, but the history reads out of order: the retry and notification commits landed late, after work that logically depends on them. You want to move that block earlier so the branch reads in the order the feature was actually built — same contents, same messages, nothing left dirty.',
    crux: 'Reordering commits with no content change; a wrong move produces a conflict.',
    shape: 'reorder',
  },
  {
    id: 'pilot-5-squash-commits',
    label: 'Squash commits',
    title: 'Squash the noise into commits that mean something',
    situation:
      'Your branch is an honest record of how you worked: “extract helper”, “wire helper”, “fix typo”, “actually wire helper”, then a few more steps. Before review, you want the history to say what changed, not narrate every keystroke.',
    crux: 'Compress the step-by-step commits into a couple of semantic ones, keep the unrelated commits separate, and end with the exact same final files and a clean worktree.',
    shape: 'squash',
  },
];

const ARMS = [
  { id: 'git', label: 'git', short: 'git', is_baseline: true },
  { id: 'jj+skill', label: 'Jujutsu', short: 'jj', vendor: 'jj' },
  {
    id: 'but+skill',
    label: 'GitButler',
    short: 'but',
    vendor: 'gitbutler',
    vendor_bias: true,
    blurb: 'GitButler built this benchmark.',
  },
];
const ARM_ORDER = ['git', 'jj+skill', 'but+skill']; // control -> challenger -> home
const AGENTS = [
  { id: 'codex', label: 'Codex' },
  { id: 'claude', label: 'Claude' },
];

const FAILURE_READS = {
  GRAPH_WRONG: {
    severity: 'near-miss',
    label: 'GRAPH_WRONG',
    read: 'Right file contents, wrong commit order.',
  },
  CONTENT_WRONG: {
    severity: 'worse-miss',
    label: 'CONTENT_WRONG',
    read: 'Final file contents or leftovers differed from the expected history.',
  },
  DIRTY_STATE_WRONG: {
    severity: 'worse-miss',
    label: 'DIRTY_STATE_WRONG',
    read: 'The final dirty worktree state differed from the expected leftovers.',
  },
  PARTITION_WRONG: {
    severity: 'worse-miss',
    label: 'PARTITION_WRONG',
    read: 'The run committed or left behind the wrong subset of changes.',
  },
};

// ---- helpers ---------------------------------------------------------------
const round = (n, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

function readJSON(p) {
  const abs = resolve(REPO, p);
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch (err) {
    throw new Error(
      `Could not read source snapshot at ${abs}\n  -> ${err.message}\n` +
        `  (raw aggregates live under the gitignored tmp/ dir; pass --aggregate if it moved)`,
    );
  }
}

function readPrompt(scenarioId) {
  // The reader-facing, tool-agnostic instruction the agent actually saw.
  const p = join(REPO, 'tasks', scenarioId, 'instruction.md');
  return readFileSync(p, 'utf8').trim();
}

// Build one normalized cell from a raw summary object (overall or by_task).
function cellFromSummary(s) {
  return {
    agent: s.agent,
    arm: s.arm,
    n: s.n,
    pass: s.pass,
    pass_rate: round((s.pass / s.n) * 100, 1),
    clean: s.pass === s.n,
    mean_wall_ms: Math.round(s.mean_wall_ms),
    median_wall_ms: Math.round(s.median_wall_ms),
    max_wall_ms: Math.round(s.max_wall_ms),
    mean_task_vc: round(s.mean_task_vc, 1),
    mean_inspect: round(s.mean_inspect, 1),
    mean_mutate: round(s.mean_mutate, 1),
    // KB is within-agent only; carried per real agent, dropped for 'both'.
    mean_cold_bytes: Math.round(s.mean_cold_bytes),
    mean_warm_bytes: Math.round(s.mean_warm_bytes),
  };
}

// Combine the two real-agent cells into a model-aware "both" cell.
// We average the per-agent means (not blind row pooling) for the cross-agent
// comparable metrics, and we DO NOT emit any KB number for 'both'.
function bothCell(codex, claude, extra = {}) {
  const avg = (a, b) => (a + b) / 2;
  const n = codex.n + claude.n;
  const pass = codex.pass + claude.pass;
  return {
    agent: 'both',
    arm: codex.arm,
    n,
    pass,
    pass_rate: round((pass / n) * 100, 1),
    clean: pass === n,
    mean_wall_ms: Math.round(avg(codex.mean_wall_ms, claude.mean_wall_ms)),
    median_wall_ms: null, // a median of two means is meaningless; omit
    max_wall_ms: Math.max(codex.max_wall_ms, claude.max_wall_ms),
    mean_task_vc: round(avg(codex.mean_task_vc, claude.mean_task_vc), 1),
    mean_inspect: round(avg(codex.mean_inspect, claude.mean_inspect), 1),
    mean_mutate: round(avg(codex.mean_mutate, claude.mean_mutate), 1),
    mean_cold_bytes: null, // cross-agent KB is not comparable — never emit it
    mean_warm_bytes: null,
    ...extra,
  };
}

// Within-agent deltas vs the same agent's git baseline. null for git cells and
// whenever a baseline is missing. KB delta only when both sides have KB.
function vsGit(cell, gitCell) {
  if (!gitCell || cell.arm === 'git') return null;
  const out = {
    time_pct: round(((cell.mean_wall_ms - gitCell.mean_wall_ms) / gitCell.mean_wall_ms) * 100, 1),
    time_speedup: round(gitCell.mean_wall_ms / cell.mean_wall_ms, 2),
    ops_pct: round(((cell.mean_task_vc - gitCell.mean_task_vc) / gitCell.mean_task_vc) * 100, 1),
    ops_ratio: round(gitCell.mean_task_vc / cell.mean_task_vc, 2),
    passrate_delta: round(cell.pass_rate - gitCell.pass_rate, 1),
    kb_pct: null,
  };
  if (cell.mean_warm_bytes != null && gitCell.mean_warm_bytes != null) {
    out.kb_pct = round(
      ((cell.mean_warm_bytes - gitCell.mean_warm_bytes) / gitCell.mean_warm_bytes) * 100,
      1,
    );
  }
  return out;
}

function unique(values) {
  return [...new Set(values.filter((v) => v != null))];
}

function rowsForArms(rows, arms) {
  return rows.filter((r) => arms.includes(r.arm));
}

function firstCompletedRow(rows, arm) {
  return rows.find((r) => r.arm === arm && r.completed);
}

function sourceSnapshotsFromAggregate(agg) {
  const rows = agg.rows;
  const snapshots = [];
  const arms = unique(rows.map((r) => r.arm));

  if (arms.includes('git') || arms.includes('but+skill')) {
    const sampleBut = firstCompletedRow(rows, 'but+skill') ?? {};
    const scopedArms = ['git', 'but+skill'].filter((arm) => arms.includes(arm));
    snapshots.push({
      batch: agg.batch,
      arms: scopedArms,
      generated_at: agg.generated_at,
      runs: rowsForArms(rows, scopedArms).length,
      provenance: {
        setup_hash: sampleBut.setup_hash ?? null,
        binary_hash: sampleBut.binary_hash ?? null,
        gitbutler_head: sampleBut.binary_head ?? null,
        skill_hash: sampleBut.skill_hash ?? null,
        skill_tree_hash: sampleBut.skill_tree_hash ?? null,
      },
    });
  }

  if (arms.includes('jj+skill')) {
    const sampleJj = firstCompletedRow(rows, 'jj+skill') ?? {};
    snapshots.push({
      batch: agg.batch,
      arms: ['jj+skill'],
      generated_at: agg.generated_at,
      runs: rowsForArms(rows, ['jj+skill']).length,
      provenance: {
        setup_hash: sampleJj.setup_hash ?? null,
        binary_hash: sampleJj.binary_hash ?? null,
        jj_version: sampleJj.binary_version ?? 'jj 0.42.0',
        skill_package: sampleJj.skill_source_package ?? 'onevcat/skills@onevcat-jj',
        skill_source_url:
          sampleJj.skill_source_url ??
          'https://raw.githubusercontent.com/onevcat/skills/master/skills/onevcat-jj/SKILL.md',
        skill_hash: sampleJj.skill_hash ?? null,
      },
    });
  }

  return snapshots;
}

function loadSources({ aggregate, baseline, jj }) {
  if (aggregate) {
    const agg = readJSON(aggregate);
    return {
      rows: agg.rows,
      summaries: agg.summaries.overall,
      byTask: agg.summaries.by_task,
      generatedAt: agg.generated_at,
      sourceSnapshots: sourceSnapshotsFromAggregate(agg),
    };
  }

  if (!baseline || !jj) {
    throw new Error('Pass either --aggregate <path> or both --baseline <path> and --jj <path>.');
  }

  const base = readJSON(baseline);
  const jjAgg = readJSON(jj);
  const sampleBase = base.rows.find((r) => r.binary_hash) || {};
  const sampleJj = jjAgg.rows.find((r) => r.binary_hash) || {};

  return {
    rows: [...base.rows, ...jjAgg.rows],
    summaries: [...base.summaries.overall, ...jjAgg.summaries.overall],
    byTask: [...base.summaries.by_task, ...jjAgg.summaries.by_task],
    generatedAt: jjAgg.generated_at ?? base.generated_at,
    sourceSnapshots: [
      {
        batch: base.batch,
        arms: ['git', 'but+skill'],
        generated_at: base.generated_at,
        runs: base.rows.length,
        provenance: {
          setup_hash: sampleBase.setup_hash ?? null,
          binary_hash: sampleBase.binary_hash ?? null,
          gitbutler_head: sampleBase.binary_head ?? null,
          skill_hash: sampleBase.skill_hash ?? null,
          skill_tree_hash: sampleBase.skill_tree_hash ?? null,
        },
      },
      {
        batch: jjAgg.batch,
        arms: ['jj+skill'],
        generated_at: jjAgg.generated_at,
        runs: jjAgg.rows.length,
        provenance: {
          setup_hash: sampleJj.setup_hash ?? null,
          binary_hash: sampleJj.binary_hash ?? null,
          jj_version: sampleJj.binary_version ?? 'jj 0.42.0',
          skill_package: sampleJj.skill_source_package ?? 'onevcat/skills@onevcat-jj',
          skill_source_url:
            sampleJj.skill_source_url ??
            'https://raw.githubusercontent.com/onevcat/skills/master/skills/onevcat-jj/SKILL.md',
          skill_hash: sampleJj.skill_hash ?? null,
        },
      },
    ],
  };
}

// ---- main ------------------------------------------------------------------
function build({ aggregate, baseline, jj, out }) {
  const source = loadSources({ aggregate, baseline, jj });
  const allRows = source.rows;
  const allSummaries = source.summaries;
  const allByTask = source.byTask;

  // ---- overall cells: 2 real agents x 3 arms, plus a 'both' per arm --------
  const overallByKey = {};
  for (const s of allSummaries) overallByKey[`${s.agent}|${s.arm}`] = cellFromSummary(s);

  const cells_overall = [];
  for (const agent of ['codex', 'claude']) {
    for (const arm of ARM_ORDER) {
      const c = overallByKey[`${agent}|${arm}`];
      if (!c) throw new Error(`Missing overall summary for ${agent} / ${arm}`);
      cells_overall.push(c);
    }
  }
  for (const arm of ARM_ORDER) {
    cells_overall.push(bothCell(overallByKey[`codex|${arm}`], overallByKey[`claude|${arm}`]));
  }
  // attach within-agent vs_git
  const overallGit = {
    codex: cells_overall.find((c) => c.agent === 'codex' && c.arm === 'git'),
    claude: cells_overall.find((c) => c.agent === 'claude' && c.arm === 'git'),
    both: cells_overall.find((c) => c.agent === 'both' && c.arm === 'git'),
  };
  for (const c of cells_overall) c.vs_git = vsGit(c, overallGit[c.agent]);

  // ---- per-scenario cells --------------------------------------------------
  const byTaskKey = {};
  for (const s of allByTask) byTaskKey[`${s.task}|${s.agent}|${s.arm}`] = s;

  // aggregate failures per (scenario, agent, arm) from rows
  const failKey = {};
  for (const r of allRows) {
    if (r.passed) continue;
    const k = `${r.task}|${r.agent}|${r.arm}`;
    (failKey[k] ||= {});
    failKey[k][r.failure] = (failKey[k][r.failure] || 0) + 1;
  }
  const failuresFor = (k) =>
    Object.entries(failKey[k] || {}).map(([failure, count]) => ({
      failure,
      count,
      severity: FAILURE_READS[failure]?.severity ?? 'unknown',
      read: FAILURE_READS[failure]?.read ?? 'Did not match the expected history.',
    }));

  const cells_by_scenario = [];
  for (const sc of SCENARIOS) {
    const scenarioCells = {};
    for (const agent of ['codex', 'claude']) {
      for (const arm of ARM_ORDER) {
        const s = byTaskKey[`${sc.id}|${agent}|${arm}`];
        if (!s) throw new Error(`Missing by_task summary for ${sc.id} / ${agent} / ${arm}`);
        const cell = cellFromSummary(s);
        cell.scenario = sc.id;
        cell.failures = failuresFor(`${sc.id}|${agent}|${arm}`);
        scenarioCells[`${agent}|${arm}`] = cell;
        cells_by_scenario.push(cell);
      }
    }
    for (const arm of ARM_ORDER) {
      const both = bothCell(scenarioCells[`codex|${arm}`], scenarioCells[`claude|${arm}`], {
        scenario: sc.id,
      });
      // 'both' failures = union list across agents (kept for the ledger view)
      both.failures = [
        ...failuresFor(`${sc.id}|codex|${arm}`),
        ...failuresFor(`${sc.id}|claude|${arm}`),
      ];
      scenarioCells[`both|${arm}`] = both;
      cells_by_scenario.push(both);
    }
    // within-agent vs_git per scenario
    const gitCell = (agent) => scenarioCells[`${agent}|git`];
    for (const c of cells_by_scenario.filter((c) => c.scenario === sc.id)) {
      c.vs_git = vsGit(c, gitCell(c.agent));
    }
  }

  // ---- slim per-run rows (distribution + verification only) ----------------
  const rows = allRows.map((r) => ({
    scenario: r.task,
    agent: r.agent,
    arm: r.arm,
    rep: r.rep,
    passed: r.passed,
    failure: r.failure,
    wall_ms: r.wall_ms,
    task_vc: r.task_vc,
    cold_bytes: r.cold_bytes,
    warm_bytes: r.warm_bytes,
  }));

  const total_runs = allRows.length;
  const total_passed = allRows.filter((r) => r.passed).length;
  const snapshotDate = new Date(source.generatedAt).toISOString().slice(0, 10);

  const data = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    meta: {
      k: 5,
      total_runs,
      total_passed,
      pass_rate: round((total_passed / total_runs) * 100, 1),
      snapshot_date: snapshotDate,
      agents: [
        ...AGENTS.map((a) => ({
          ...a,
          observed_model: a.id === 'codex' ? 'gpt-5.5' : null,
        })),
        { id: 'both', label: 'Both', note: 'Codex + Claude, averaged' },
      ],
      arms: ARMS,
      arm_order: ARM_ORDER,
      scenarios: SCENARIOS.map((s) => ({
        id: s.id,
        label: s.label,
        title: s.title,
        situation: s.situation,
        crux: s.crux,
        shape: s.shape,
        prompt: readPrompt(s.id),
      })),
      comparability: {
        wall_ms: { cross_agent: true, within_agent: true },
        task_vc: { cross_agent: true, within_agent: true },
        pass: { cross_agent: true, within_agent: true },
        warm_bytes: { cross_agent: false, within_agent: true },
      },
      kb_comparable_within_agent_only: true,
      kb_note:
        'warm_bytes subtracts visible skill/reference reads — a token-cost proxy, not a token counter. Claude and Codex record transcripts in different formats, so KB is only comparable between tools within the same agent.',
      generator: 'node scripts/build-web-data.mjs',
    },
    source_snapshots: source.sourceSnapshots,
    cells_overall,
    cells_by_scenario,
    rows,
  };

  validate(data);
  const outAbs = resolve(REPO, out);
  mkdirSync(dirname(outAbs), { recursive: true });
  writeFileSync(outAbs, JSON.stringify(data, null, 2) + '\n');
  return { data, outAbs };
}

function validate(d) {
  const armsSeen = new Set(d.cells_overall.map((c) => c.arm));
  for (const arm of ARM_ORDER) if (!armsSeen.has(arm)) throw new Error(`validate: arm ${arm} missing`);
  const agentsSeen = new Set(d.cells_overall.map((c) => c.agent));
  for (const a of ['codex', 'claude', 'both']) if (!agentsSeen.has(a)) throw new Error(`validate: agent ${a} missing`);
  if (d.rows.length !== 150) throw new Error(`validate: expected 150 rows, got ${d.rows.length}`);
  if (d.cells_overall.length !== 9) throw new Error(`validate: expected 9 overall cells, got ${d.cells_overall.length}`);
  if (d.cells_by_scenario.length !== 45) throw new Error(`validate: expected 45 scenario cells, got ${d.cells_by_scenario.length}`);
  // honesty firewall: no 'both' cell may carry a KB number
  for (const c of [...d.cells_overall, ...d.cells_by_scenario]) {
    if (c.agent === 'both' && (c.mean_warm_bytes != null || c.mean_cold_bytes != null)) {
      throw new Error(`validate: 'both' cell carries cross-agent KB (forbidden) for arm ${c.arm}`);
    }
  }
  if (d.meta.total_runs !== 150) {
    throw new Error(`validate: expected 150 runs, got ${d.meta.total_runs}`);
  }
}

const args = parseArgs(process.argv.slice(2));
const { data, outAbs } = build(args);
console.log(`Wrote ${outAbs}`);
console.log(
  `  ${data.meta.total_passed}/${data.meta.total_runs} passed · ` +
    `${data.cells_overall.length} overall cells · ${data.cells_by_scenario.length} scenario cells · ${data.rows.length} rows`,
);
