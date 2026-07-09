#!/usr/bin/env node
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs } from "./lib/args.mjs";
import { pairedMeanCI, quantile, wilsonInterval } from "./lib/stats.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const TASKS = [
  { id: "pilot-1-selective-validation", label: "Selective commit" },
  { id: "pilot-2-multi-amend", label: "Multi-amend" },
  { id: "pilot-3-split-commit", label: "Split commit" },
  { id: "pilot-4-reorder-commits", label: "Reorder commits" },
  { id: "pilot-5-squash-commits", label: "Squash commits" },
];
const AGENTS = ["codex", "claude"];
const ARMS = ["git", "but+skill", "jj+skill", "jj-axi+skill"];

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function listArg(value, allowed, label) {
  const items = (value ?? allowed.join(","))
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  for (const item of items) {
    if (!allowed.includes(item)) {
      throw new Error(`Unknown ${label}: ${item}. Expected one of: ${allowed.join(", ")}`);
    }
  }
  return items;
}

function taskListArg(value) {
  const allowed = TASKS.map((task) => task.id);
  return listArg(value, allowed, "task");
}

function armSlug(arm) {
  return arm.replaceAll("+", "plus");
}

function rel(filePath) {
  return path.relative(repoRoot, filePath);
}

function runLogged(cmd, args, { cwd, logPath }) {
  const fd = openSync(logPath, "w");
  try {
    return spawnSync(cmd, args, {
      cwd,
      stdio: ["ignore", fd, fd],
    });
  } finally {
    closeSync(fd);
  }
}

function runCapture(cmd, args, options = {}) {
  return spawnSync(cmd, args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function plannedRuns({ tasks, agents, arms, k, batchName, batchDir }) {
  const runs = [];
  let idx = 1;
  for (let rep = 1; rep <= k; rep += 1) {
    for (const task of tasks) {
      for (const agent of agents) {
        for (const arm of arms) {
          const runId = `${batchName}-${String(idx).padStart(3, "0")}-${task}-${agent}-${armSlug(arm)}-r${rep}`;
          runs.push({
            idx,
            task,
            task_label: TASKS.find((candidate) => candidate.id === task)?.label ?? task,
            agent,
            arm,
            rep,
            run_id: runId,
            run_dir: path.join(batchDir, runId),
            log_path: path.join(batchDir, `${runId}.log`),
          });
          idx += 1;
        }
      }
    }
  }
  return runs;
}

function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function taskFailedSamples(result) {
  return (result?.measurement?.commands?.failed_command_samples ?? [])
    .filter((entry) => entry.bucket === "task")
    .map((entry) => ({
      tool: entry.tool,
      status: entry.status,
      argv: entry.argv,
    }));
}

function rowFromPlan(plan) {
  const result = readJsonIfExists(path.join(plan.run_dir, "result.json"));
  const completed = result !== null;
  const passed = result?.verifier?.passed === true;
  const exit = completed && result.agent_result?.status === 0 && passed ? 0 : completed ? 1 : null;
  const transcript = result?.measurement?.transcript ?? {};
  const timing = result?.measurement?.timing ?? {};
  const taskRuntime = timing.observed_command_runtime?.task_vc?.duration_ms_sum ?? null;
  const toolBinary = result?.tool_binary ?? result?.but_binary ?? result?.jj_binary ?? null;
  return {
    ...plan,
    run_dir: rel(plan.run_dir),
    log_path: rel(plan.log_path),
    result_path: completed ? rel(path.join(plan.run_dir, "result.json")) : null,
    completed,
    exit,
    passed,
    failure: result?.run_failure_class ?? (completed ? null : "NO_RESULT"),
    score: result?.verifier?.score ?? null,
    wall_ms: result?.agent_result?.duration_ms ?? null,
    first_mutation_ms: timing.agent_start_to_first_successful_task_mutation_ms ?? null,
    task_vc: result?.metrics?.task_vc_command_count ?? null,
    inspect: result?.metrics?.task_vc_inspection_count ?? null,
    mutate: result?.metrics?.task_vc_mutation_count ?? null,
    failed_task_vc: result?.metrics?.task_failed_vc_commands ?? null,
    parser: result?.metrics?.parser_command_count ?? null,
    platform_vc: result?.metrics?.platform_vc_command_count ?? null,
    repeated_state_queries: result?.metrics?.repeated_state_queries ?? null,
    cold_bytes: transcript.total_bytes ?? null,
    warm_bytes: transcript.warm_estimated_total_bytes ?? null,
    skill_output_bytes: transcript.skill_reference_output_bytes ?? null,
    task_vc_runtime_ms: taskRuntime,
    configured_model: result?.model ?? null,
    observed_model: result?.observed_model ?? result?.agent_output?.observed_model ?? result?.model ?? null,
    agent_cli_version: result?.agent_cli_version ?? null,
    setup_hash: result?.agent_instructions?.setup_block_sha256 ?? null,
    binary_hash: toolBinary?.sha256 ?? null,
    binary_dirty: toolBinary?.source_git?.dirty ?? null,
    binary_head: toolBinary?.source_git?.head ?? null,
    binary_version: toolBinary?.version ?? null,
    skill_name: result?.skill?.name ?? null,
    skill_source_package: result?.skill?.source_package ?? null,
    skill_source_url: result?.skill?.source_url ?? null,
    skill_hash: result?.skill?.skill_file_sha256 ?? result?.skill?.skill_md_sha256 ?? null,
    skill_tree_hash: result?.skill?.source_dir_sha256 ?? result?.skill?.tree_sha256 ?? null,
    skill_dirty: result?.skill?.source_git?.dirty ?? null,
    skill_head: result?.skill?.source_git?.head ?? null,
    failed_command_samples: completed ? taskFailedSamples(result) : [],
  };
}

function numeric(rows, field) {
  return rows.map((row) => row[field]).filter((value) => Number.isFinite(value));
}

function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function max(values) {
  if (values.length === 0) return null;
  return Math.max(...values);
}

function groupKey(row, fields) {
  return fields.map((field) => row[field]).join("\t");
}

function groupRows(rows, fields) {
  const groups = new Map();
  for (const row of rows) {
    const key = groupKey(row, fields);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([key, group]) => ({ key, group }));
}

function summarizeGroup(rows) {
  const wall = numeric(rows, "wall_ms");
  const firstMutation = numeric(rows, "first_mutation_ms");
  const cold = numeric(rows, "cold_bytes");
  const warm = numeric(rows, "warm_bytes");
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
    max_wall_ms: max(wall),
    mean_task_vc: mean(numeric(rows, "task_vc")),
    mean_inspect: mean(numeric(rows, "inspect")),
    mean_mutate: mean(numeric(rows, "mutate")),
    mean_failed_task_vc: mean(numeric(rows, "failed_task_vc")),
    mean_parser: mean(numeric(rows, "parser")),
    mean_platform_vc: mean(numeric(rows, "platform_vc")),
    mean_repeated_state_queries: mean(numeric(rows, "repeated_state_queries")),
    mean_first_mutation_ms: mean(firstMutation),
    mean_task_vc_runtime_ms: mean(numeric(rows, "task_vc_runtime_ms")),
    mean_cold_bytes: mean(cold),
    mean_warm_bytes: mean(warm),
  };
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function seconds(ms) {
  return Number.isFinite(ms) ? `${round(ms / 1000, 1)}s` : "n/a";
}

function count(value, digits = 1) {
  return Number.isFinite(value) ? String(round(value, digits)) : "n/a";
}

function kb(bytes) {
  return Number.isFinite(bytes) ? String(round(bytes / 1024, 1)) : "n/a";
}

function pct(value, digits = 0) {
  return Number.isFinite(value) ? `${round(value * 100, digits)}%` : "n/a";
}

function passCiCell(summary) {
  if (!Number.isFinite(summary.pass_ci_lo)) return "n/a";
  return `${pct(summary.pass_ci_lo)}-${pct(summary.pass_ci_hi)}`;
}

function pairedCell(stat, { scale = 1, unit = "", digits = 1 } = {}) {
  if (!stat || !Number.isFinite(stat.mean)) return "n/a";
  const fmt = (value) => `${value > 0 ? "+" : ""}${round(value * scale, digits)}${unit}`;
  if (!Number.isFinite(stat.lo)) return fmt(stat.mean);
  return `${fmt(stat.mean)} [${fmt(stat.lo)}, ${fmt(stat.hi)}]`;
}

function delta(newValue, baseValue) {
  if (!Number.isFinite(newValue) || !Number.isFinite(baseValue)) return { abs: null, pct: null };
  return {
    abs: newValue - baseValue,
    pct: baseValue === 0 ? null : ((newValue - baseValue) / baseValue) * 100,
  };
}

function deltaCell(newValue, baseValue, { unit = "", digits = 1 } = {}) {
  const d = delta(newValue, baseValue);
  if (!Number.isFinite(d.abs)) return "n/a";
  const sign = d.abs > 0 ? "+" : "";
  const value = `${sign}${round(d.abs, digits)}${unit}`;
  if (!Number.isFinite(d.pct)) return value;
  const pctSign = d.pct > 0 ? "+" : "";
  return `${value} (${pctSign}${round(d.pct, 1)}%)`;
}

function markdownTable(headers, rows) {
  const align = headers.map(() => "---");
  return [
    `| ${headers.join(" | ")} |`,
    `| ${align.join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function aggregate(plans, batchDir, commandLine) {
  const rows = plans.map(rowFromPlan);
  const summaries = {
    overall: groupRows(rows, ["agent", "arm"]).map(({ group }) => {
      const first = group[0];
      return { agent: first.agent, arm: first.arm, ...summarizeGroup(group) };
    }),
    by_task: groupRows(rows, ["task", "task_label", "agent", "arm"]).map(({ group }) => {
      const first = group[0];
      return {
        task: first.task,
        task_label: first.task_label,
        agent: first.agent,
        arm: first.arm,
        ...summarizeGroup(group),
      };
    }),
  };

  // Task-clustered statistics: the trial samples within one task cell are
  // correlated, so reliability claims aggregate per-task scores, and arm
  // comparisons use paired per-task differences against the git arm.
  for (const overall of summaries.overall) {
    const cells = summaries.by_task.filter(
      (cell) => cell.agent === overall.agent && cell.arm === overall.arm,
    );
    overall.task_count = cells.length;
    overall.tasks_all_pass = cells.filter((cell) => cell.n > 0 && cell.pass === cell.n).length;
  }

  summaries.paired_vs_git = [];
  const agents = unique(rows.map((row) => row.agent));
  const arms = unique(rows.map((row) => row.arm)).filter((arm) => arm !== "git");
  const taskIds = unique(rows.map((row) => row.task));
  for (const agent of agents) {
    for (const arm of arms) {
      const passDeltas = [];
      const wallDeltas = [];
      const taskVcDeltas = [];
      for (const task of taskIds) {
        const git = summaryLookup(summaries.by_task, { task, agent, arm: "git" });
        const candidate = summaryLookup(summaries.by_task, { task, agent, arm });
        if (!git || !candidate || git.n === 0 || candidate.n === 0) continue;
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
      summaries.paired_vs_git.push({
        agent,
        arm,
        pass_rate_delta: pairedMeanCI(passDeltas),
        wall_ms_delta: pairedMeanCI(wallDeltas),
        task_vc_delta: pairedMeanCI(taskVcDeltas),
      });
    }
  }

  const aggregateJson = {
    batch: rel(batchDir),
    generated_at: new Date().toISOString(),
    command: commandLine,
    rows,
    summaries,
  };
  writeFileSync(path.join(batchDir, "aggregate.json"), JSON.stringify(aggregateJson, null, 2));
  writeFileSync(path.join(batchDir, "manifest.tsv"), renderManifest(rows));
  writeFileSync(path.join(batchDir, "report.md"), renderReport(aggregateJson));
  return aggregateJson;
}

function renderManifest(rows) {
  return [
    "idx\ttask\tagent\tarm\trep\texit\trun_dir",
    ...rows.map((row) => [
      row.idx,
      row.task,
      row.agent,
      row.arm,
      row.rep,
      row.exit ?? "",
      row.run_dir,
    ].join("\t")),
  ].join("\n") + "\n";
}

function summaryLookup(summaries, fields) {
  return summaries.find((summary) => Object.entries(fields).every(([key, value]) => summary[key] === value));
}

function renderReport(data) {
  const { rows, summaries } = data;
  const total = rows.length;
  const completed = rows.filter((row) => row.completed).length;
  const passed = rows.filter((row) => row.passed).length;
  const allPassed = passed === total && completed === total;
  const agents = [...new Set(rows.map((row) => row.agent))];
  const arms = [...new Set(rows.map((row) => row.arm))];
  const comparisonArms = arms.filter((arm) => arm !== "git");
  const tasks = [...new Map(rows.map((row) => [row.task, row.task_label])).entries()];

  const headlineDeltas = [];
  for (const agent of agents) {
    const git = summaryLookup(summaries.overall, { agent, arm: "git" });
    if (!git) continue;
    for (const arm of comparisonArms) {
      const candidate = summaryLookup(summaries.overall, { agent, arm });
      if (!candidate) continue;
      headlineDeltas.push({
        agent,
        arm,
        wall: delta(candidate.mean_wall_ms, git.mean_wall_ms),
        taskVc: delta(candidate.mean_task_vc, git.mean_task_vc),
      });
    }
  }

  const headlineBits = headlineDeltas.map((item) => {
    const wallPct = Number.isFinite(item.wall.pct) ? `${round(Math.abs(item.wall.pct), 1)}%` : "n/a";
    const taskPct = Number.isFinite(item.taskVc.pct) ? `${round(Math.abs(item.taskVc.pct), 1)}%` : "n/a";
    const wallDirection = item.wall.abs <= 0 ? "lower" : "higher";
    const taskDirection = item.taskVc.abs <= 0 ? "fewer" : "more";
    return `${item.agent} ${item.arm}: ${wallPct} ${wallDirection} mean wall, ${taskPct} ${taskDirection} task VC commands`;
  });
  const headlineDeltaSentence = headlineBits.length > 0
    ? ` ${headlineBits.join("; ")}.`
    : "";

  const overallRows = summaries.overall
    .sort((a, b) => `${a.agent}-${a.arm}`.localeCompare(`${b.agent}-${b.arm}`))
    .map((summary) => [
      title(summary.agent),
      `\`${summary.arm}\``,
      String(summary.n),
      `${summary.pass}/${summary.n}`,
      passCiCell(summary),
      Number.isFinite(summary.task_count) ? `${summary.tasks_all_pass}/${summary.task_count}` : "n/a",
      seconds(summary.mean_wall_ms),
      seconds(summary.median_wall_ms),
      seconds(summary.p90_wall_ms),
      seconds(summary.max_wall_ms),
      count(summary.mean_task_vc),
      count(summary.mean_inspect),
      count(summary.mean_mutate),
      count(summary.mean_failed_task_vc),
      count(summary.mean_parser),
      kb(summary.mean_cold_bytes),
      kb(summary.mean_warm_bytes),
    ]);

  const overallDeltaRows = [];
  for (const agent of agents) {
    const git = summaryLookup(summaries.overall, { agent, arm: "git" });
    for (const arm of comparisonArms) {
      const candidate = summaryLookup(summaries.overall, { agent, arm });
      overallDeltaRows.push([
        title(agent),
        `\`${arm}\``,
        git && candidate ? deltaCell(candidate.mean_wall_ms / 1000, git.mean_wall_ms / 1000, { unit: "s" }) : "n/a",
        git && candidate ? deltaCell(candidate.mean_task_vc, git.mean_task_vc) : "n/a",
        git && candidate ? deltaCell(candidate.mean_failed_task_vc, git.mean_failed_task_vc) : "n/a",
        git && candidate ? deltaCell((candidate.mean_warm_bytes ?? 0) / 1024, (git.mean_warm_bytes ?? 0) / 1024, { unit: " KB" }) : "n/a",
      ]);
    }
  }

  const byTaskRows = summaries.by_task
    .sort((a, b) => `${a.task}-${a.agent}-${a.arm}`.localeCompare(`${b.task}-${b.agent}-${b.arm}`))
    .map((summary) => [
      summary.task_label,
      title(summary.agent),
      `\`${summary.arm}\``,
      `${summary.pass}/${summary.n}`,
      passCiCell(summary),
      seconds(summary.mean_wall_ms),
      seconds(summary.median_wall_ms),
      seconds(summary.max_wall_ms),
      count(summary.mean_task_vc),
      count(summary.mean_inspect),
      count(summary.mean_mutate),
      count(summary.mean_failed_task_vc),
      kb(summary.mean_warm_bytes),
    ]);

  const taskDeltaRows = [];
  for (const [task, label] of tasks) {
    for (const agent of agents) {
      const git = summaryLookup(summaries.by_task, { task, agent, arm: "git" });
      for (const arm of comparisonArms) {
        const candidate = summaryLookup(summaries.by_task, { task, agent, arm });
        taskDeltaRows.push([
          label,
          title(agent),
          `\`${arm}\``,
          git && candidate ? deltaCell(candidate.mean_wall_ms / 1000, git.mean_wall_ms / 1000, { unit: "s" }) : "n/a",
          git && candidate ? deltaCell(candidate.mean_task_vc, git.mean_task_vc) : "n/a",
          git && candidate ? deltaCell(candidate.mean_failed_task_vc, git.mean_failed_task_vc) : "n/a",
          git && candidate ? deltaCell((candidate.mean_warm_bytes ?? 0) / 1024, (git.mean_warm_bytes ?? 0) / 1024, { unit: " KB" }) : "n/a",
        ]);
      }
    }
  }

  const failedRuns = rows.filter((row) => !row.passed || row.exit !== 0);
  const commandHiccups = rows
    .filter((row) => row.failed_command_samples.length > 0)
    .flatMap((row) => row.failed_command_samples.map((sample) => ({ row, sample })))
    .slice(0, 30);

  const provenance = provenanceLines(rows);

  return [
    `# Full k=${perGroupK(rows)} Matrix`,
    "",
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    "",
    `Batch: \`${data.batch}\``,
    "",
    `Scope: ${tasks.length} tasks, ${agents.map(title).join(" and ")}, ${arms.map((arm) => `\`${arm}\``).join(" vs ")}, ${total} planned runs.`,
    "",
    "## Headline",
    "",
    `${allPassed ? "All" : `${passed}/${total}`} runs passed verifier checks.${headlineDeltaSentence}`,
    "",
    "Correctness is the gate: any speed or command-count comparison below should be read within each agent and task pair.",
    "",
    "## Overall",
    "",
    markdownTable(
      ["Agent", "Arm", "n", "Pass", "Pass 95% CI", "Tasks all-k", "Mean Wall", "Median Wall", "P90 Wall", "Max Wall", "Task VC", "Inspect", "Mutate", "Failed Task VC", "Parser", "Cold KB", "Warm KB"],
      overallRows,
    ),
    "",
    "## Overall Deltas",
    "",
    "Negative means the selected arm was lower than plain `git`.",
    "",
    markdownTable(
      ["Agent", "Arm", "Mean Wall Delta", "Task VC Delta", "Failed Task VC Delta", "Warm KB Delta"],
      overallDeltaRows,
    ),
    "",
    "## Paired Per-Task Deltas vs `git`",
    "",
    "Each task contributes one paired difference (arm minus `git`, same agent and task); cells show the mean paired difference with a t-based 95% CI over tasks. Trials within a task are correlated, so this task-clustered comparison is the statistically meaningful one.",
    "",
    markdownTable(
      ["Agent", "Arm", "Pass Rate Delta (pp)", "Mean Wall Delta", "Task VC Delta", "Tasks"],
      (summaries.paired_vs_git ?? []).map((entry) => [
        title(entry.agent),
        `\`${entry.arm}\``,
        pairedCell(entry.pass_rate_delta, { scale: 100, unit: " pp", digits: 1 }),
        pairedCell(entry.wall_ms_delta, { scale: 1 / 1000, unit: "s", digits: 1 }),
        pairedCell(entry.task_vc_delta, { digits: 1 }),
        String(entry.wall_ms_delta?.n ?? entry.pass_rate_delta?.n ?? 0),
      ]),
    ),
    "",
    "## By Task",
    "",
    markdownTable(
      ["Task", "Agent", "Arm", "Pass", "Pass 95% CI", "Mean Wall", "Median Wall", "Max Wall", "Task VC", "Inspect", "Mutate", "Failed Task VC", "Warm KB"],
      byTaskRows,
    ),
    "",
    "## Pairwise Deltas",
    "",
    "Negative means the selected arm was lower than plain `git` for the same task and agent.",
    "",
    markdownTable(
      ["Task", "Agent", "Arm", "Mean Wall Delta", "Task VC Delta", "Failed Task VC Delta", "Warm KB Delta"],
      taskDeltaRows,
    ),
    "",
    "## Hiccups",
    "",
    failedRuns.length === 0
      ? "No verifier or agent-runtime failures."
      : markdownTable(
          ["Run", "Task", "Agent", "Arm", "Failure", "Log"],
          failedRuns.map((row) => [row.run_id, row.task_label, title(row.agent), `\`${row.arm}\``, row.failure ?? "unknown", `\`${row.log_path}\``]),
        ),
    "",
    commandHiccups.length === 0
      ? "No failed task-visible VC commands were recorded."
      : markdownTable(
          ["Run", "Tool", "Status", "Command"],
          commandHiccups.map(({ row, sample }) => [row.run_id, `\`${sample.tool}\``, String(sample.status), `\`${sample.argv.replaceAll("|", "\\|")}\``]),
        ),
    "",
    "## Provenance",
    "",
    provenance.length === 0 ? "No non-git provenance was recorded." : provenance.join("\n"),
    "",
    "## Notes",
    "",
    "- Pass-rate intervals are Wilson 95% intervals over the trials in the cell; with small n they are intentionally wide.",
    "- Trials of the same task are correlated, so cross-task claims use task-level aggregation: the paired-deltas table pairs per-task means (df = tasks - 1), and per-cell CIs should not be read as evidence about version-control work beyond these tasks.",
    "- \"Tasks all-k\" counts tasks where every trial passed (per-task pass^k) - the reliability gate for unattended use.",
    "- Pre-run fixture setup, tool setup, applying task branches, skill installation, local agent instruction files, and dirty-state application are excluded from measured agent duration and command metrics.",
    "- This report uses task-relevant VC command counts, not tool-internal commands or agent platform probes, for the headline command comparison.",
    "- Claude transcript bytes and Codex transcript bytes are not directly comparable; read transcript deltas within the same agent.",
    "- The warm transcript estimate subtracts visible skill/reference reads. It is not a token counter.",
    "",
    "## Raw Evidence",
    "",
    `- Aggregate JSON: \`${path.join(data.batch, "aggregate.json")}\``,
    `- Manifest: \`${path.join(data.batch, "manifest.tsv")}\``,
    `- Run logs: \`${data.batch}/*.log\``,
    `- Command: \`${data.command.join(" ").replaceAll("`", "\\`")}\``,
    "",
  ].join("\n");
}

function title(value) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function perGroupK(rows) {
  const counts = groupRows(rows, ["task", "agent", "arm"]).map(({ group }) => group.length);
  return [...new Set(counts)].join("/");
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))];
}

function provenanceLines(rows) {
  const lines = [];
  const agents = unique(rows.map((row) => row.agent));
  if (agents.length > 0) {
    lines.push("### Agents");
    for (const agent of agents) {
      const agentRows = rows.filter((row) => row.agent === agent && row.completed);
      if (agentRows.length === 0) continue;
      const configured = unique(agentRows.map((row) => row.configured_model ? `\`${row.configured_model}\`` : null)).join(", ") || "n/a";
      const observed = unique(agentRows.map((row) => row.observed_model ? `\`${row.observed_model}\`` : null)).join(", ") || "n/a";
      const cliVersion = unique(agentRows.map((row) => row.agent_cli_version ? `\`${row.agent_cli_version}\`` : null)).join(", ") || "n/a";
      lines.push(`- ${title(agent)} configured model: ${configured}`);
      lines.push(`- ${title(agent)} observed model: ${observed}`);
      lines.push(`- ${title(agent)} CLI version: ${cliVersion}`);
    }
  }

  const arms = unique(rows.map((row) => row.arm)).filter((arm) => arm !== "git");
  if (lines.length > 0 && arms.length > 0) lines.push("");
  for (const arm of arms) {
    const armRows = rows.filter((row) => row.arm === arm && row.completed);
    if (armRows.length === 0) continue;
    lines.push(`### \`${arm}\``);
    lines.push(`- Setup block SHA-256: ${unique(armRows.map((row) => `\`${row.setup_hash}\``)).join(", ") || "n/a"}`);
    lines.push(`- Binary SHA-256: ${unique(armRows.map((row) => `\`${row.binary_hash}\``)).join(", ") || "n/a"}`);
    lines.push(`- Binary version: ${unique(armRows.map((row) => row.binary_version ? `\`${row.binary_version}\`` : null)).join(", ") || "n/a"}`);
    lines.push(`- Skill: ${unique(armRows.map((row) => row.skill_name ? `\`${row.skill_name}\`` : null)).join(", ") || "n/a"}`);
    lines.push(`- Skill package: ${unique(armRows.map((row) => row.skill_source_package ? `\`${row.skill_source_package}\`` : null)).join(", ") || "n/a"}`);
    lines.push(`- Skill source URL: ${unique(armRows.map((row) => row.skill_source_url ? `[source](${row.skill_source_url})` : null)).join(", ") || "n/a"}`);
    lines.push(`- Skill file SHA-256: ${unique(armRows.map((row) => `\`${row.skill_hash}\``)).join(", ") || "n/a"}`);
    lines.push(`- Skill tree SHA-256: ${unique(armRows.map((row) => `\`${row.skill_tree_hash}\``)).join(", ") || "n/a"}`);
    lines.push(`- Source head: ${unique(armRows.map((row) => `\`${row.binary_head ?? row.skill_head}\``)).join(", ") || "n/a"}`);
    lines.push(`- Binary dirty: ${unique(armRows.map((row) => `\`${row.binary_dirty}\``)).join(", ") || "n/a"}`);
    lines.push(`- Skill dirty: ${unique(armRows.map((row) => `\`${row.skill_dirty}\``)).join(", ") || "n/a"}`);
  }
  return lines;
}

function writePlan(batchDir, plans) {
  writeFileSync(
    path.join(batchDir, "plan.tsv"),
    [
      "idx\ttask\tagent\tarm\trep\trun_id\trun_dir\tlog_path",
      ...plans.map((plan) => [
        plan.idx,
        plan.task,
        plan.agent,
        plan.arm,
        plan.rep,
        plan.run_id,
        rel(plan.run_dir),
        rel(plan.log_path),
      ].join("\t")),
    ].join("\n") + "\n",
  );
}

function appendProgress(batchDir, plan, status, note) {
  const file = path.join(batchDir, "progress.tsv");
  if (!existsSync(file)) {
    writeFileSync(file, "idx\trun_id\tstatus\tnote\n");
  }
  writeFileSync(file, `${plan.idx}\t${plan.run_id}\t${status}\t${note ?? ""}\n`, { flag: "a" });
}

const args = parseArgs(process.argv.slice(2));
const k = Number(args.get("k") ?? 5);
if (!Number.isInteger(k) || k < 1) {
  throw new Error(`--k must be a positive integer, got ${args.get("k")}`);
}

const tasks = taskListArg(args.get("tasks"));
const agents = listArg(args.get("agents"), AGENTS, "agent");
const arms = listArg(args.get("arms"), ARMS, "arm");
const dryRun = args.get("dry-run") === "true";
const resume = args.get("resume") !== "false";
const buildBut = args.get("build-but") !== "false" && arms.includes("but+skill");
const failOnFailures = args.get("fail-on-failures") === "true";
const timeoutMs = args.get("timeout-ms") ?? "900000";
const codexModel = args.get("codex-model") ?? null;
const claudeModel = args.get("claude-model") ?? null;
const gitbutlerRoot = path.resolve(args.get("gitbutler-root") ?? "/Users/kiril/src/gitbutler");
const butBin = path.resolve(args.get("but-bin") ?? path.join(gitbutlerRoot, "target/release/but"));
const skillDir = path.resolve(args.get("skill-dir") ?? path.join(gitbutlerRoot, "crates/but/skill"));
const jjBin = args.get("jj-bin") ? path.resolve(args.get("jj-bin")) : null;
const jjSkillDir = args.get("jj-skill-dir") ? path.resolve(args.get("jj-skill-dir")) : null;
const jjSkillPackage = args.get("jj-skill-package") ?? null;
const jjSkillName = args.get("jj-skill-name") ?? null;
const jjSkillUrl = args.get("jj-skill-url") ?? null;
const jjAxiBin = args.get("jj-axi-bin") ? path.resolve(args.get("jj-axi-bin")) : null;
const jjAxiSkillDir = args.get("jj-axi-skill-dir") ? path.resolve(args.get("jj-axi-skill-dir")) : null;
if (arms.includes("jj-axi+skill") && (!jjAxiBin || !jjAxiSkillDir)) {
  throw new Error("--arms jj-axi+skill requires --jj-axi-bin and --jj-axi-skill-dir");
}
const batchName = args.get("batch-name") ?? `full-k${k}-${timestamp()}`;
const batchDir = path.resolve(args.get("out") ?? path.join(repoRoot, "tmp/pilot-runs", batchName));
const commandLine = ["node", "scripts/run-full-matrix.mjs", ...process.argv.slice(2)];

mkdirSync(batchDir, { recursive: true });

const plans = plannedRuns({ tasks, agents, arms, k, batchName, batchDir });
writePlan(batchDir, plans);

if (dryRun) {
  console.log(`Dry run: ${plans.length} planned runs`);
  console.log(`Batch: ${rel(batchDir)}`);
  console.log(`Plan: ${rel(path.join(batchDir, "plan.tsv"))}`);
  process.exit(0);
}

if (buildBut) {
  const build = runCapture("cargo", ["build", "-p", "but", "--release"], { cwd: gitbutlerRoot });
  writeFileSync(path.join(batchDir, "but-build.log"), `${build.stdout}${build.stderr}`);
  if (build.status !== 0) {
    console.error(`GitButler build failed; see ${rel(path.join(batchDir, "but-build.log"))}`);
    process.exit(build.status ?? 1);
  }
}

for (const plan of plans) {
  const resultPath = path.join(plan.run_dir, "result.json");
  if (resume && existsSync(resultPath)) {
    appendProgress(batchDir, plan, 0, "skipped-existing-result");
    continue;
  }

  const runArgs = [
    "scripts/run-pilot-agent.mjs",
    "--task", plan.task,
    "--agent", plan.agent,
    "--arm", plan.arm,
    "--but-bin", butBin,
    "--skill-dir", skillDir,
    "--timeout-ms", timeoutMs,
    "--run-id", plan.run_id,
    "--out", plan.run_dir,
  ];
  const planModel = plan.agent === "codex" ? codexModel : claudeModel;
  if (planModel) runArgs.push("--model", planModel);
  if (jjBin) runArgs.push("--jj-bin", jjBin);
  if (jjSkillDir) runArgs.push("--jj-skill-dir", jjSkillDir);
  if (jjSkillPackage) runArgs.push("--jj-skill-package", jjSkillPackage);
  if (jjSkillName) runArgs.push("--jj-skill-name", jjSkillName);
  if (jjSkillUrl) runArgs.push("--jj-skill-url", jjSkillUrl);
  if (jjAxiBin) runArgs.push("--jj-axi-bin", jjAxiBin);
  if (jjAxiSkillDir) runArgs.push("--jj-axi-skill-dir", jjAxiSkillDir);

  console.log(`[${plan.idx}/${plans.length}] ${plan.task} ${plan.agent} ${plan.arm} r${plan.rep}`);
  const started = Date.now();
  const result = runLogged("node", runArgs, { cwd: repoRoot, logPath: plan.log_path });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  appendProgress(batchDir, plan, result.status ?? 1, `${elapsed}s`);
  console.log(`[${plan.idx}/${plans.length}] exit ${result.status ?? 1} after ${elapsed}s`);
  aggregate(plans, batchDir, commandLine);
}

const aggregateJson = aggregate(plans, batchDir, commandLine);
const failed = aggregateJson.rows.filter((row) => row.exit !== 0 || !row.passed);
console.log(`Report: ${rel(path.join(batchDir, "report.md"))}`);
console.log(`Aggregate: ${rel(path.join(batchDir, "aggregate.json"))}`);
console.log(`Manifest: ${rel(path.join(batchDir, "manifest.tsv"))}`);
if (failed.length > 0) {
  console.error(`${failed.length} runs failed verifier or agent runtime checks; report written.`);
  if (failOnFailures) {
    process.exit(1);
  }
}
