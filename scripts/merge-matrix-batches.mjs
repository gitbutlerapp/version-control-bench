#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib/args.mjs";
import { pairedMeanCI, quantile, wilsonInterval } from "./lib/stats.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const DEFAULT_EXPECTED_TASKS = [
  "pilot-1-selective-validation",
  "pilot-2-multi-amend",
  "pilot-3-split-commit",
  "pilot-4-reorder-commits",
  "pilot-5-squash-commits",
  "pilot-6-update-dirty-branch",
];
const DEFAULT_EXPECTED_AGENTS = ["codex", "claude"];
const DEFAULT_EXPECTED_ARMS = ["git", "but+skill", "jj+skill"];

function rel(filePath) {
  return path.relative(repoRoot, filePath);
}

function unique(values) {
  return [...new Set(values)];
}

function numeric(rows, field) {
  return rows.map((row) => row[field]).filter(Number.isFinite);
}

function mean(values) {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function groupRows(rows, fields) {
  const groups = new Map();
  for (const row of rows) {
    const key = fields.map((field) => row[field]).join("\t");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()];
}

function summarizeGroup(rows) {
  const wall = numeric(rows, "wall_ms");
  const pass = rows.filter((row) => row.passed).length;
  const passCi = wilsonInterval(pass, rows.length);
  return {
    n: rows.length,
    completed: rows.filter((row) => row.completed).length,
    pass,
    pass_rate: rows.length > 0 ? pass / rows.length : null,
    pass_ci_lo: passCi?.lo ?? null,
    pass_ci_hi: passCi?.hi ?? null,
    mean_wall_ms: mean(wall),
    median_wall_ms: median(wall),
    p90_wall_ms: quantile(wall, 0.9),
    max_wall_ms: wall.length > 0 ? Math.max(...wall) : null,
    mean_task_vc: mean(numeric(rows, "task_vc")),
    mean_inspect: mean(numeric(rows, "inspect")),
    mean_mutate: mean(numeric(rows, "mutate")),
    mean_failed_task_vc: mean(numeric(rows, "failed_task_vc")),
    mean_parser: mean(numeric(rows, "parser")),
    mean_platform_vc: mean(numeric(rows, "platform_vc")),
    mean_repeated_state_queries: mean(numeric(rows, "repeated_state_queries")),
    mean_first_mutation_ms: mean(numeric(rows, "first_mutation_ms")),
    mean_task_vc_runtime_ms: mean(numeric(rows, "task_vc_runtime_ms")),
    mean_cold_bytes: mean(numeric(rows, "cold_bytes")),
    mean_warm_bytes: mean(numeric(rows, "warm_bytes")),
    mean_tokens: mean(numeric(rows, "tokens")),
  };
}

function summaryLookup(summaries, fields) {
  return summaries.find((summary) => Object.entries(fields).every(([key, value]) => summary[key] === value));
}

function buildSummaries(rows, k) {
  const summaries = {
    overall: groupRows(rows, ["agent", "arm"]).map((group) => ({
      agent: group[0].agent,
      arm: group[0].arm,
      ...summarizeGroup(group),
    })),
    by_task: groupRows(rows, ["task", "task_label", "agent", "arm"]).map((group) => ({
      task: group[0].task,
      task_label: group[0].task_label,
      agent: group[0].agent,
      arm: group[0].arm,
      ...summarizeGroup(group),
    })),
  };

  for (const overall of summaries.overall) {
    const cells = summaries.by_task.filter(
      (cell) => cell.agent === overall.agent && cell.arm === overall.arm,
    );
    overall.task_count = cells.length;
    overall.tasks_all_pass = cells.filter((cell) => cell.n === k && cell.pass === k).length;
  }

  summaries.paired_vs_git = [];
  const agents = unique(rows.map((row) => row.agent));
  const arms = unique(rows.map((row) => row.arm)).filter((arm) => arm !== "git");
  const tasks = unique(rows.map((row) => row.task));
  for (const agent of agents) {
    for (const arm of arms) {
      const passDeltas = [];
      const wallDeltas = [];
      const taskVcDeltas = [];
      for (const task of tasks) {
        const git = summaryLookup(summaries.by_task, { task, agent, arm: "git" });
        const candidate = summaryLookup(summaries.by_task, { task, agent, arm });
        if (!git || !candidate || git.n !== k || candidate.n !== k) continue;
        passDeltas.push(candidate.pass / candidate.n - git.pass / git.n);
        wallDeltas.push(
          Number.isFinite(candidate.mean_wall_ms) && Number.isFinite(git.mean_wall_ms)
            ? candidate.mean_wall_ms - git.mean_wall_ms
            : NaN,
        );
        taskVcDeltas.push(
          Number.isFinite(candidate.mean_task_vc) && Number.isFinite(git.mean_task_vc)
            ? candidate.mean_task_vc - git.mean_task_vc
            : NaN,
        );
      }
      if (passDeltas.length > 0) {
        summaries.paired_vs_git.push({
          agent,
          arm,
          pass_rate_delta: pairedMeanCI(passDeltas),
          wall_ms_delta: pairedMeanCI(wallDeltas),
          task_vc_delta: pairedMeanCI(taskVcDeltas),
        });
      }
    }
  }
  return summaries;
}

function resolveAggregate(input) {
  const direct = path.resolve(input);
  const named = path.join(repoRoot, "tmp/pilot-runs", input);
  const candidate = existsSync(direct) ? direct : named;
  const aggregatePath = existsSync(candidate) && statSync(candidate).isDirectory()
    ? path.join(candidate, "aggregate.json")
    : candidate;
  if (!existsSync(aggregatePath)) {
    throw new Error(`Batch aggregate not found: ${input}`);
  }
  const data = JSON.parse(readFileSync(aggregatePath, "utf8"));
  if (!Array.isArray(data.rows) || data.rows.length === 0) {
    throw new Error(`Batch aggregate has no rows: ${rel(aggregatePath)}`);
  }
  return { input, aggregatePath, data };
}

function inferK(source) {
  if (Number.isInteger(source.data.matrix?.k) && source.data.matrix.k > 0) {
    return source.data.matrix.k;
  }
  const counts = groupRows(source.data.rows, ["task", "agent", "arm"]).map((group) => group.length);
  const values = unique(counts);
  if (values.length !== 1 || values[0] < 1) {
    throw new Error(`Cannot infer one k from ${rel(source.aggregatePath)} (cell sizes: ${values.join(", ")})`);
  }
  const k = values[0];
  for (const group of groupRows(source.data.rows, ["task", "agent", "arm"])) {
    const reps = group.map((row) => row.rep).sort((a, b) => a - b);
    const expected = Array.from({ length: k }, (_, index) => index + 1);
    if (JSON.stringify(reps) !== JSON.stringify(expected)) {
      throw new Error(`Invalid reps in ${rel(source.aggregatePath)} for ${group[0].task}/${group[0].agent}/${group[0].arm}`);
    }
  }
  return k;
}

function listArg(value, defaults, label) {
  const values = (value ?? defaults.join(",")).split(",").map((item) => item.trim()).filter(Boolean);
  if (values.length === 0) throw new Error(`Expected at least one ${label}`);
  if (unique(values).length !== values.length) throw new Error(`Duplicate ${label}: ${values.join(", ")}`);
  return values;
}

function positiveIntegerArg(value, label) {
  if (value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer: ${value}`);
  return parsed;
}

function assertOneValue(rows, fields, valueField, label) {
  for (const group of groupRows(rows, fields)) {
    const values = unique(group.map((row) => row[valueField] ?? null));
    if (values.length !== 1) {
      const scope = fields.map((field) => `${field}=${group[0][field]}`).join(", ");
      throw new Error(`Inconsistent ${label} for ${scope}: ${values.map(String).join(", ")}`);
    }
  }
}

function validateConsistency(rows) {
  for (const [field, label] of [
    ["configured_model", "configured model"],
    ["observed_model", "observed model"],
    ["agent_cli_version", "agent CLI version"],
  ]) {
    assertOneValue(rows, ["agent"], field, label);
  }

  const provenanceFields = [
    "setup_hash", "binary_hash", "binary_dirty", "binary_head", "binary_version",
    "skill_name", "skill_source_package", "skill_source_url", "skill_hash",
    "skill_tree_hash", "skill_dirty", "skill_head",
  ];
  for (const field of provenanceFields) {
    assertOneValue(rows, ["arm"], field, field.replaceAll("_", " "));
  }
  assertOneValue(rows, ["task"], "task_label", "task label");
}

function validateNoDuplicates(rows) {
  const cells = new Map();
  const runIds = new Set();
  for (const row of rows) {
    const key = [row.task, row.agent, row.arm, row.rep].join("/");
    if (cells.has(key)) {
      throw new Error(`Duplicate task/agent/arm/rep cell ${key}: ${cells.get(key)} and ${row.run_id}`);
    }
    if (runIds.has(row.run_id)) throw new Error(`Duplicate run_id: ${row.run_id}`);
    cells.set(key, row.run_id);
    runIds.add(row.run_id);
  }
}

function validateReps(rows, k, label) {
  for (const row of rows) {
    if (!Number.isInteger(row.rep) || row.rep < 1 || row.rep > k) {
      throw new Error(`Invalid rep in ${label} for ${row.task}/${row.agent}/${row.arm}: ${row.rep}; expected an integer from 1 to ${k}`);
    }
  }
}

function assertExactValues(actual, expected, label) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((value) => !actualSet.has(value));
  const unexpected = actual.filter((value) => !expectedSet.has(value));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `Unexpected strict ${label} dimensions: missing [${missing.join(", ")}], unexpected [${unexpected.join(", ")}]`,
    );
  }
}

function validateExpectedDimensions(rows, k, expected) {
  if (expected.k !== null && k !== expected.k) {
    throw new Error(`Unexpected strict k: got ${k}, expected ${expected.k}`);
  }
  assertExactValues(unique(rows.map((row) => row.task)), expected.tasks, "task");
  assertExactValues(unique(rows.map((row) => row.agent)), expected.agents, "agent");
  assertExactValues(unique(rows.map((row) => row.arm)), expected.arms, "arm");
  const expectedRows = expected.tasks.length * expected.agents.length * expected.arms.length * k;
  if (rows.length !== expectedRows) {
    throw new Error(`Unexpected strict row count: got ${rows.length}, expected ${expectedRows}`);
  }
}

function validateRectangular(rows, k) {
  const tasks = unique(rows.map((row) => row.task));
  const agents = unique(rows.map((row) => row.agent));
  const arms = unique(rows.map((row) => row.arm));
  const cells = new Set(rows.map((row) => [row.task, row.agent, row.arm, row.rep].join("/")));
  const missing = [];
  for (const task of tasks) {
    for (const agent of agents) {
      for (const arm of arms) {
        for (let rep = 1; rep <= k; rep += 1) {
          const key = [task, agent, arm, rep].join("/");
          if (!cells.has(key)) missing.push(key);
        }
      }
    }
  }
  if (missing.length > 0) {
    const sample = missing.slice(0, 8).join(", ");
    throw new Error(`Merged matrix is not rectangular: ${missing.length} cells missing (${sample}${missing.length > 8 ? ", ..." : ""}). Use --partial true for an interim merge.`);
  }
  const expectedRows = tasks.length * agents.length * arms.length * k;
  if (rows.length !== expectedRows) {
    throw new Error(`Merged matrix has ${rows.length} rows; expected exactly ${expectedRows}`);
  }
  const incomplete = rows.filter((row) => row.completed !== true);
  if (incomplete.length > 0) {
    throw new Error(`Merged matrix contains ${incomplete.length} incomplete rows; use --partial true for an interim merge.`);
  }
}

function renderManifest(rows) {
  return [
    "idx\ttask\tagent\tarm\trep\texit\trun_dir\tsource_batch",
    ...rows.map((row) => [row.idx, row.task, row.agent, row.arm, row.rep, row.exit ?? "", row.run_dir, row.source_batch].join("\t")),
  ].join("\n") + "\n";
}

function round(value, digits = 1) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function seconds(ms) {
  return Number.isFinite(ms) ? `${round(ms / 1000)}s` : "n/a";
}

function count(value) {
  return Number.isFinite(value) ? String(round(value)) : "n/a";
}

function percent(value) {
  return Number.isFinite(value) ? `${round(value * 100, 1)}%` : "n/a";
}

function pairedCell(stat, scale = 1, unit = "") {
  if (!stat || !Number.isFinite(stat.mean)) return "n/a";
  const format = (value) => `${value > 0 ? "+" : ""}${round(value * scale)}${unit}`;
  return Number.isFinite(stat.lo)
    ? `${format(stat.mean)} [${format(stat.lo)}, ${format(stat.hi)}]`
    : format(stat.mean);
}

function table(headers, body) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function renderReport(data) {
  const { rows, summaries } = data;
  const failed = rows.filter((row) => !row.passed || row.exit !== 0);
  const overall = [...summaries.overall]
    .sort((a, b) => `${a.agent}/${a.arm}`.localeCompare(`${b.agent}/${b.arm}`))
    .map((item) => [
      item.agent, `\`${item.arm}\``, String(item.n), `${item.pass}/${item.n}`,
      seconds(item.mean_wall_ms), seconds(item.p90_wall_ms), count(item.mean_task_vc),
      `${item.tasks_all_pass}/${item.task_count}`,
    ]);
  const byTask = [...summaries.by_task]
    .sort((a, b) => `${a.task}/${a.agent}/${a.arm}`.localeCompare(`${b.task}/${b.agent}/${b.arm}`))
    .map((item) => [
      item.task_label, item.agent, `\`${item.arm}\``, `${item.pass}/${item.n}`,
      seconds(item.mean_wall_ms), count(item.mean_task_vc), count(item.mean_failed_task_vc),
    ]);
  const paired = summaries.paired_vs_git.map((item) => [
    item.agent, `\`${item.arm}\``, pairedCell(item.pass_rate_delta, 100, " pp"),
    pairedCell(item.wall_ms_delta, 1 / 1000, "s"), pairedCell(item.task_vc_delta),
    String(item.wall_ms_delta?.n ?? item.pass_rate_delta?.n ?? 0),
  ]);
  const modelRows = unique(rows.map((row) => row.agent)).sort().map((agent) => {
    const row = rows.find((candidate) => candidate.agent === agent);
    return [agent, row.configured_model ?? "n/a", row.observed_model ?? "n/a", row.agent_cli_version ?? "n/a"];
  });
  const provenanceRows = unique(rows.map((row) => row.arm)).filter((arm) => arm !== "git").sort().map((arm) => {
    const row = rows.find((candidate) => candidate.arm === arm);
    return [
      `\`${arm}\``, row.setup_hash ?? "n/a", row.binary_hash ?? "n/a",
      row.binary_head ?? row.skill_head ?? "n/a", row.skill_name ?? "n/a", row.skill_hash ?? "n/a",
    ];
  });
  const sourceLines = data.source_batches.map((source) => `- \`${source.batch}\` (k=${source.k}, ${source.rows} planned rows, ${source.included_rows} included)`);
  const pairedDescription = data.matrix.partial
    ? `Only tasks with all k=${data.matrix.k} completed rows in both arms contribute; intervals are t-based 95% CIs over those tasks.`
    : "Each task contributes one paired arm-minus-git difference; intervals are t-based 95% CIs over tasks.";
  const failureBody = failed.length === 0
    ? "No verifier or agent-runtime failures."
    : table(["Run", "Task", "Agent", "Arm", "Failure"], failed.map((row) => [
        row.run_id, row.task_label, row.agent, `\`${row.arm}\``, row.failure ?? "unknown",
      ]));
  return [
    `# Merged k=${data.matrix.k} Matrix`, "",
    `Date: ${data.generated_at.slice(0, 10)}`, "",
    `Batch: \`${data.batch}\``, "",
    `Validation: ${data.matrix.partial ? "partial (incomplete planned rows omitted)" : "strict rectangular"}.`, "",
    "## Sources", "", ...sourceLines, "",
    "## Headline", "",
    `${rows.filter((row) => row.passed).length}/${rows.length} included runs passed verifier checks; ${failed.length} failed.`, "",
    "## Overall", "",
    table(["Agent", "Arm", "n", "Pass", "Mean Wall", "P90 Wall", "Task VC", "Tasks all-k"], overall), "",
    "## Paired Per-Task Deltas vs `git`", "",
    pairedDescription, "",
    table(["Agent", "Arm", "Pass Delta", "Wall Delta", "Task VC Delta", "Tasks"], paired), "",
    "## By Task", "",
    table(["Task", "Agent", "Arm", "Pass", "Mean Wall", "Task VC", "Failed Task VC"], byTask), "",
    "## Failures", "", failureBody, "",
    "## Provenance", "",
    table(["Agent", "Configured Model", "Observed Model", "CLI Version"], modelRows), "",
    provenanceRows.length === 0
      ? "No non-git provenance was recorded."
      : table(["Arm", "Setup SHA-256", "Binary SHA-256", "Source Head", "Skill", "Skill SHA-256"], provenanceRows), "",
    "## Notes", "",
    `- Matrix dimensions: ${data.matrix.tasks.length} tasks × ${data.matrix.agents.length} agents × ${data.matrix.arms.length} arms × k=${data.matrix.k}.`,
    "- Summaries were recomputed from source rows; source summary objects were not reused.",
    "- Models, CLI versions, task labels, and arm provenance are required to be consistent.",
    "- Trials within a task are correlated, so cross-task comparisons use task-level paired differences.", "",
  ].join("\n");
}

function positionalInput(argv) {
  const flagsWithValues = new Set([
    "batches", "out", "partial", "expected-k", "expected-tasks", "expected-agents", "expected-arms",
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item.startsWith("--")) {
      if (flagsWithValues.has(item.slice(2)) && argv[index + 1] && !argv[index + 1].startsWith("--")) index += 1;
      continue;
    }
    return item;
  }
  return null;
}

const argv = process.argv.slice(2);
const args = parseArgs(argv);
const batchArg = args.get("batches") ?? positionalInput(argv);
const outArg = args.get("out");
const partial = args.get("partial") === "true";
if (!batchArg || !outArg) {
  throw new Error("Usage: node scripts/merge-matrix-batches.mjs --batches batch-a,batch-b --out <batch-dir> [--partial true] [--expected-k 10] [--expected-tasks ...] [--expected-agents ...] [--expected-arms ...]");
}

const expected = {
  k: positiveIntegerArg(args.get("expected-k"), "--expected-k"),
  tasks: listArg(args.get("expected-tasks"), DEFAULT_EXPECTED_TASKS, "tasks"),
  agents: listArg(args.get("expected-agents"), DEFAULT_EXPECTED_AGENTS, "agents"),
  arms: listArg(args.get("expected-arms"), DEFAULT_EXPECTED_ARMS, "arms"),
};

const sources = batchArg.split(",").map((value) => value.trim()).filter(Boolean).map(resolveAggregate);
if (sources.length < 1) throw new Error("At least one input batch is required");
const outputDir = path.resolve(outArg);
for (const source of sources) {
  if (path.resolve(source.aggregatePath) === path.join(outputDir, "aggregate.json")) {
    throw new Error(`Output would overwrite input aggregate: ${rel(source.aggregatePath)}`);
  }
}

const ks = sources.map(inferK);
if (unique(ks).length !== 1) throw new Error(`Input batches have inconsistent k values: ${ks.join(", ")}`);
const k = ks[0];
for (let index = 0; index < sources.length; index += 1) {
  validateReps(sources[index].data.rows, k, rel(sources[index].aggregatePath));
}
let rows = sources.flatMap((source) => source.data.rows.map((row) => ({
  ...row,
  source_batch: source.data.batch ?? rel(path.dirname(source.aggregatePath)),
  source_idx: row.idx,
})));
if (partial) rows = rows.filter((row) => row.completed === true);
if (rows.length === 0) throw new Error("No completed rows to merge");

validateNoDuplicates(rows);
validateReps(rows, k, "merged rows");
if (!partial) {
  validateExpectedDimensions(rows, k, expected);
  validateRectangular(rows, k);
}
validateConsistency(rows);

rows.sort((a, b) => `${a.task}\t${a.agent}\t${a.arm}\t${String(a.rep).padStart(6, "0")}`
  .localeCompare(`${b.task}\t${b.agent}\t${b.arm}\t${String(b.rep).padStart(6, "0")}`));
rows = rows.map((row, index) => ({ ...row, idx: index + 1 }));
const tasks = unique(rows.map((row) => row.task));
const agents = unique(rows.map((row) => row.agent));
const arms = unique(rows.map((row) => row.arm));
const command = ["node", "scripts/merge-matrix-batches.mjs", ...argv];
const aggregate = {
  batch: rel(outputDir),
  generated_at: new Date().toISOString(),
  command,
  source_batches: sources.map((source, index) => ({
    batch: source.data.batch ?? rel(path.dirname(source.aggregatePath)),
    aggregate: rel(source.aggregatePath),
    k: ks[index],
    rows: source.data.rows.length,
    included_rows: partial ? source.data.rows.filter((row) => row.completed === true).length : source.data.rows.length,
  })),
  matrix: { k, partial, tasks, agents, arms, expected },
  rows,
  summaries: buildSummaries(rows, k),
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(path.join(outputDir, "aggregate.json"), JSON.stringify(aggregate, null, 2) + "\n");
writeFileSync(path.join(outputDir, "manifest.tsv"), renderManifest(rows));
writeFileSync(path.join(outputDir, "report.md"), renderReport(aggregate));
console.log(`Merged ${rows.length} rows from ${sources.length} batches (k=${k}, ${partial ? "partial" : "strict"})`);
console.log(`Aggregate: ${rel(path.join(outputDir, "aggregate.json"))}`);
console.log(`Manifest: ${rel(path.join(outputDir, "manifest.tsv"))}`);
console.log(`Report: ${rel(path.join(outputDir, "report.md"))}`);
