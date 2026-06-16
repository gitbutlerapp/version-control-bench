#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { run } from "./lib/process.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const taskDir = path.join(repoRoot, "tasks/pilot-1-selective-validation");
const DEFAULT_CODEX_MODEL = "gpt-5.5";

const GIT_MUTATIONS = new Set([
  "add",
  "am",
  "apply",
  "branch",
  "checkout",
  "cherry-pick",
  "clean",
  "commit",
  "merge",
  "mv",
  "rebase",
  "reset",
  "restore",
  "revert",
  "rm",
  "stash",
  "switch",
  "tag",
  "update-index",
  "update-ref",
]);

const GIT_INSPECTIONS = new Set([
  "status",
  "diff",
  "show",
  "log",
  "rev-parse",
  "for-each-ref",
  "branch",
  "remote",
  "ls-remote",
  "ls-files",
  "cat-file",
  "diff-tree",
  "merge-base",
  "symbolic-ref",
]);

const BUT_MUTATIONS = new Set([
  "commit",
  "stage",
  "branch",
  "merge",
  "discard",
  "resolve",
  "unapply",
  "apply",
  "clean",
  "pick",
  "rub",
  "absorb",
  "reword",
  "uncommit",
  "amend",
  "squash",
  "move",
  "push",
  "pull",
  "setup",
  "teardown",
]);

const BUT_INSPECTIONS = new Set(["status", "diff", "show", "oplog"]);
function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      args.set(arg.slice(2), argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true");
    }
  }
  return args;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function commandPath(command) {
  const result = spawnSync("bash", ["-lc", `command -v ${shellQuote(command)} || true`], {
    encoding: "utf8",
  });
  return result.stdout.trim();
}

function copyIfExists(source, dest) {
  if (!existsSync(source)) return false;
  cpSync(source, dest);
  return true;
}

function prepareCodexHome(runDir, enabled) {
  if (!enabled) return null;

  const sourceHome = path.resolve(process.env.CODEX_HOME ?? path.join(process.env.HOME ?? "", ".codex"));
  const codexHome = path.join(runDir, "codex-home");
  mkdirSync(codexHome, { recursive: true });

  return {
    path: codexHome,
    source_home: sourceHome,
    auth_copied: copyIfExists(path.join(sourceHome, "auth.json"), path.join(codexHome, "auth.json")),
    installation_id_copied: copyIfExists(path.join(sourceHome, "installation_id"), path.join(codexHome, "installation_id")),
  };
}

function writeWrapper(binDir, tool, realPath, tracePath, arm) {
  const wrapperPath = path.join(binDir, tool);
  const blockGitWrites = tool === "git" && arm === "but+skill";
  const blockBut = tool === "but" && arm === "git";
  const mutationList = [...GIT_MUTATIONS].join("|");

  const body = `#!/usr/bin/env bash
set +e
REAL=${shellQuote(realPath)}
TRACE=${shellQuote(tracePath)}
TOOL=${shellQuote(tool)}
ARM=${shellQuote(arm)}
now_ms() {
  perl -MTime::HiRes=time -e 'printf "%.0f", time() * 1000' 2>/dev/null || printf '%s000' "$(date +%s)"
}
START_MS="$(now_ms)"
PARENT="$(ps -p "$PPID" -o comm= 2>/dev/null | tr -d '[:space:]')"
GRANDPARENT_PID="$(ps -p "$PPID" -o ppid= 2>/dev/null | tr -d '[:space:]')"
GRANDPARENT=""
if [[ -n "$GRANDPARENT_PID" ]]; then
  GRANDPARENT="$(ps -p "$GRANDPARENT_PID" -o comm= 2>/dev/null | tr -d '[:space:]')"
fi
INTERNAL=false
if [[ "$TOOL" == "git" && ( "$PARENT" == *but* || "$GRANDPARENT" == *but* ) ]]; then
  INTERNAL=true
fi
trace_argv() {
  local joined="$*"
  joined="\${joined//$'\\t'/ }"
  joined="\${joined//$'\\r'/\\\\r}"
  joined="\${joined//$'\\n'/\\\\n}"
  printf '%s' "$joined"
}
TRACE_ARGV="$(trace_argv "$@")"
POLICY_BLOCK=false
if [[ ${blockBut ? "true" : "false"} == true ]]; then
  POLICY_BLOCK=true
fi
if [[ ${blockGitWrites ? "true" : "false"} == true && "$INTERNAL" != true ]]; then
  SUBCOMMAND=""
  ARGS=("$@")
  IDX=0
  while [[ $IDX -lt $# ]]; do
    ARG="\${ARGS[$IDX]}"
    case "$ARG" in
      -c|-C|--git-dir|--work-tree)
        IDX=$((IDX + 2))
        ;;
      --git-dir=*|--work-tree=*)
        IDX=$((IDX + 1))
        ;;
      *)
        SUBCOMMAND="$ARG"
        break
        ;;
    esac
  done
  case "$SUBCOMMAND" in
    ${mutationList}) POLICY_BLOCK=true ;;
  esac
fi
if [[ "$POLICY_BLOCK" == true ]]; then
  STATUS=42
  END_MS="$(now_ms)"
  DURATION_MS=$((END_MS - START_MS))
  printf 'v2\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\n' "$START_MS" "$END_MS" "$DURATION_MS" "$TOOL" "$STATUS" "$PWD" "$PARENT" "$GRANDPARENT" "$INTERNAL" "$TRACE_ARGV" >> "$TRACE"
  echo "version-control-bench policy blocked: $TOOL $*" >&2
  exit "$STATUS"
fi
"$REAL" "$@"
STATUS=$?
END_MS="$(now_ms)"
DURATION_MS=$((END_MS - START_MS))
printf 'v2\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\n' "$START_MS" "$END_MS" "$DURATION_MS" "$TOOL" "$STATUS" "$PWD" "$PARENT" "$GRANDPARENT" "$INTERNAL" "$TRACE_ARGV" >> "$TRACE"
exit "$STATUS"
`;

  writeFileSync(wrapperPath, body, { mode: 0o755 });
}

function createWrappers(runDir, arm, realBut) {
  const binDir = path.join(runDir, "bin");
  mkdirSync(binDir, { recursive: true });
  const tracePath = path.join(runDir, "command-trace.tsv");
  writeFileSync(tracePath, "");

  const realGit = commandPath("git");
  writeWrapper(binDir, "git", realGit, tracePath, arm);
  writeWrapper(binDir, "but", realBut, tracePath, arm);

  return { binDir, tracePath };
}

function parseSkillVersion(skillFile) {
  const content = readFileSync(skillFile, "utf8");
  const match = content.match(/^version:\s*"?([^"\n]+)"?\s*$/m);
  return match?.[1] ?? null;
}

function appendHarnessExclude(workspace) {
  writeFileSync(
    path.join(workspace, ".git/info/exclude"),
    "\n# version-control-bench harness files\n.codex/\n.claude/\nAGENTS.md\nCLAUDE.md\n",
    { flag: "a" },
  );
}

function writeAgentInstructionFiles(workspace, content) {
  writeFileSync(path.join(workspace, "AGENTS.md"), content);
  writeFileSync(path.join(workspace, "CLAUDE.md"), content.replace("# AGENTS.md", "# CLAUDE.md"));
}

function installPlainGitInstructions(workspace) {
  writeAgentInstructionFiles(workspace, `# AGENTS.md

## Version control

- Use plain Git CLI for version-control write operations.
- Do not use GitButler CLI (\`but\`) in this benchmark trial.
- Commit only changes requested by the task.
- Do not push or open pull requests unless the user asks.
- Keep commit messages succinct: explain what changed.
`);

  appendHarnessExclude(workspace);

  return {
    installed_codex: path.join(workspace, "AGENTS.md"),
    installed_claude: path.join(workspace, "CLAUDE.md"),
  };
}

function installGitButlerSkill(workspace, skillDir) {
  const skillFile = path.join(skillDir, "SKILL.md");
  if (!existsSync(skillFile)) {
    throw new Error(`GitButler skill file not found: ${skillFile}`);
  }

  const refsDir = path.join(skillDir, "references");
  const installed = [];

  for (const root of [".codex/skills/but", ".claude/skills/but"]) {
    const dest = path.join(workspace, root);
    mkdirSync(dest, { recursive: true });
    cpSync(skillFile, path.join(dest, "SKILL.md"));
    if (existsSync(refsDir)) {
      cpSync(refsDir, path.join(dest, "references"), { recursive: true });
    }
    installed.push(dest);
  }

  const codexSkillPath = path.join(workspace, ".codex/skills/but/SKILL.md");
  const claudeSkillPath = path.join(workspace, ".claude/skills/but/SKILL.md");
  writeAgentInstructionFiles(workspace, `# AGENTS.md

## Local skill

The GitButler CLI skill is installed for this benchmark trial:

- but: Commit, branch, inspect, and manage version control with GitButler. Use it for task-level version-control inspection and write operations. (file: ${codexSkillPath})
- but: Commit, branch, inspect, and manage version control with GitButler. Use it for task-level version-control inspection and write operations. (file: ${claudeSkillPath})

## Version control

- Use GitButler (\`but\`) for task-level version-control inspection and write operations, including status, diffs, branching, committing, pushing, and history edits.
- For selected dirty files or hunks, start with \`but diff\`, then commit selected IDs with \`but commit <branch> -c -m "<msg>" --changes <ids>\`. Do not run \`git status\` or \`git diff\` as task preflight in this arm.
- Pass selected IDs as comma-separated values in one \`--changes\` argument, for example \`--changes a1,b2\`. Do not pass selected IDs as separate space-separated arguments after one \`--changes\`.
- Do not run \`but status -fv\` as routine preflight for selected dirty-file or hunk commits. Use it when existing branch, stack, commit, conflict, or history state matters.
- Assume multiple agents may be working in this repository. Do not move, amend, squash, discard, commit, push, or otherwise modify another agent's work unless the user asks.
- Use a dedicated GitButler branch for each agent session, unless the user asks for a different branch structure. Commit only changes that belong to that session.
- Do not push or open pull requests unless the user asks.
- Keep commit messages and pull request descriptions succinct: explain what changed, why it changed, and any important decision.
`);

  appendHarnessExclude(workspace);

  return {
    source_dir: skillDir,
    version: parseSkillVersion(skillFile),
    installed,
    instructions: {
      installed_codex: path.join(workspace, "AGENTS.md"),
      installed_claude: path.join(workspace, "CLAUDE.md"),
      source_url: "https://docs.gitbutler.com/ai-agents/getting-started#add-optional-agent-instructions",
    },
  };
}

function prepareWorkspace(runDir, arm, realBut, skillDir) {
  const workspace = path.join(runDir, "workspace");
  const dirty = arm !== "but+skill";
  run("node", [path.join(repoRoot, "scripts/create-pilot-fixture.mjs"), "--out", workspace, "--force", "true", "--dirty", String(dirty)], {
    cwd: repoRoot,
  });

  if (arm === "but+skill") {
    run(realBut, ["setup"], { cwd: workspace, stdio: "pipe" });
    const setup = installGitButlerSkill(workspace, skillDir);
    run("node", [path.join(repoRoot, "scripts/apply-pilot-state.mjs"), "dirty", workspace], { cwd: repoRoot });
    return { workspace, setup };
  }

  return { workspace, setup: { instructions: installPlainGitInstructions(workspace) } };
}

function buildPrompt() {
  const instruction = readFileSync(path.join(taskDir, "instruction.md"), "utf8").trim();

  return [
    "You are running inside a version-control benchmark sandbox.",
    "All requested file changes already exist. Do not implement new code; only perform the requested version-control operation.",
    "Work only in the current repository. Do not inspect parent benchmark directories, hidden oracle files, or solution scripts.",
    "",
    `Task: ${instruction}`,
    "",
    "When the repository state is correct, stop.",
  ].join("\n");
}

function runAgent(agent, workspace, prompt, env, model, timeoutMs) {
  const start = Date.now();
  let cmd;
  let args;

  if (agent === "codex") {
    cmd = "codex";
    args = [
      "exec",
      "-C",
      workspace,
      "--dangerously-bypass-approvals-and-sandbox",
    ];
    if (env.VCB_CODEX_CLEAN_CONFIG === "true") {
      args.push("--ignore-user-config", "--ignore-rules", "--ephemeral");
      if (env.VCB_CODEX_DISABLE_PLUGINS === "true") {
        args.push("--disable", "plugins");
      }
    }
    if (model) args.push("-m", model);
    args.push(prompt);
  } else if (agent === "claude") {
    cmd = "claude";
    args = ["-p", "--permission-mode", "bypassPermissions", "--output-format", "text"];
    if (model) args.push("--model", model);
    args.push(prompt);
  } else {
    throw new Error(`Unknown agent: ${agent}`);
  }

  const result = spawnSync(cmd, args, {
    cwd: workspace,
    env,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
  });
  const end = Date.now();

  return {
    cmd,
    args: args.map((arg) => (arg === prompt ? "<prompt>" : arg)),
    status: result.status,
    signal: result.signal,
    timed_out: result.error?.code === "ETIMEDOUT",
    start_ms: start,
    end_ms: end,
    duration_ms: end - start,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error ? String(result.error) : null,
  };
}

function parseAgentModel(agentResult) {
  return agentResult.stderr.match(/^model:\s*(.+)$/m)?.[1] ?? null;
}

function verify(workspace) {
  const result = run("node", [path.join(repoRoot, "scripts/verify-pilot.mjs"), "--repo", workspace, "--task", taskDir], {
    cwd: repoRoot,
    check: false,
  });

  try {
    return JSON.parse(result.stdout);
  } catch {
    return {
      passed: false,
      failure_class: "BAD_VERIFIER_OUTPUT",
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }
}

function parseTrace(tracePath) {
  if (!existsSync(tracePath)) return [];
  return readFileSync(tracePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      if (parts[0] === "v2") {
        if (parts.length < 10) return null;
        const [schema, startMs, endMs, durationMs, tool, status, cwd, parent, grandparent, internal] = parts;
        return {
          schema,
          start_ms: Number(startMs),
          end_ms: Number(endMs),
          duration_ms: Number(durationMs),
          ts: Math.floor(Number(startMs) / 1000),
          tool,
          status: Number(status),
          cwd,
          parent,
          grandparent,
          internal: internal === "true",
          argv: parts.slice(10).join("\t"),
        };
      }

      if (parts.length < 7) return null;
      const legacy = parts.length === 7;
      const [ts, tool, status, cwd, parent] = parts;
      const grandparent = legacy ? "" : parts[5];
      const internal = legacy ? parts[5] : parts[6];
      const argv = (legacy ? parts.slice(6) : parts.slice(7)).join("\t");
      return {
        schema: "legacy",
        start_ms: Number(ts) * 1000,
        end_ms: null,
        duration_ms: null,
        ts: Number(ts),
        tool,
        status: Number(status),
        cwd,
        parent,
        grandparent,
        internal: internal === "true",
        argv,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const startDelta = (entryStartMs(a) ?? 0) - (entryStartMs(b) ?? 0);
      if (startDelta !== 0) return startDelta;
      return (entryEndMs(a) ?? 0) - (entryEndMs(b) ?? 0);
    });
}

function markImplicitToolInternal(trace) {
  const butMutations = trace.filter((entry) => entry.tool === "but" && isMutation(entry));

  for (const entry of trace) {
    if (entry.internal || entry.tool !== "git") continue;
    const { command, args } = vcSubcommand(entry);
    if (command !== "symbolic-ref" || args.join(" ") !== "--short HEAD") continue;

    const start = entryStartMs(entry);
    const end = entryEndMs(entry);
    const overlapsButMutation = butMutations.some((butEntry) => {
      const butStart = entryStartMs(butEntry);
      const butEnd = entryEndMs(butEntry);
      return start !== null && end !== null && butStart !== null && butEnd !== null && start >= butStart && end <= butEnd;
    });

    if (overlapsButMutation) entry.internal = true;
  }

  return trace;
}

function commandParts(argv) {
  return argv.trim().split(/\s+/).filter(Boolean);
}

function vcSubcommand(entry) {
  const parts = commandParts(entry.argv);
  let i = 0;

  if (entry.tool === "git") {
    while (i < parts.length) {
      const part = parts[i];
      if (part === "-c") {
        i += 2;
        continue;
      }
      if (part === "--no-optional-locks") {
        i += 1;
        continue;
      }
      if (part === "-C" || part === "--git-dir" || part === "--work-tree") {
        i += 2;
        continue;
      }
      if (part.startsWith("--git-dir=") || part.startsWith("--work-tree=")) {
        i += 1;
        continue;
      }
      break;
    }
  }

  if (entry.tool === "but") {
    while (i < parts.length) {
      const part = parts[i];
      if (part === "-C" || part === "--current-dir" || part === "--format") {
        i += 2;
        continue;
      }
      if (part.startsWith("--current-dir=") || part.startsWith("--format=")) {
        i += 1;
        continue;
      }
      break;
    }
  }

  return { command: parts[i] ?? "", args: parts.slice(i + 1) };
}

function isGitInspection(entry) {
  const { command, args } = vcSubcommand(entry);
  if (args.includes("--help") || args.includes("-h")) return true;
  if (command === "branch") {
    return args.includes("--list") || args.includes("--show-current") || args.length === 0;
  }
  return GIT_INSPECTIONS.has(command);
}

function isGitMutation(entry) {
  const { command, args } = vcSubcommand(entry);
  if (args.includes("--help") || args.includes("-h")) return false;
  if (command === "branch") {
    return !(args.includes("--list") || args.includes("--show-current") || args.length === 0);
  }
  return GIT_MUTATIONS.has(command);
}

function isButInspection(entry) {
  const { command, args } = vcSubcommand(entry);
  return args.includes("--help") || args.includes("-h") || BUT_INSPECTIONS.has(command);
}

function isButMutation(entry) {
  const { command, args } = vcSubcommand(entry);
  return !args.includes("--help") && !args.includes("-h") && BUT_MUTATIONS.has(command);
}

function isShellParent(parent) {
  if (!parent) return false;
  return ["sh", "bash", "zsh", "/bin/sh", "/bin/bash", "/bin/zsh"].some((shell) => parent === shell || parent.endsWith(`/${shell}`));
}

function isVcEntry(entry) {
  return entry.tool === "git" || entry.tool === "but";
}

function isNumber(value) {
  return Number.isFinite(value);
}

function entryStartMs(entry) {
  if (!entry) return null;
  if (isNumber(entry.start_ms)) return entry.start_ms;
  if (isNumber(entry.ts)) return entry.ts * 1000;
  return null;
}

function entryEndMs(entry) {
  if (!entry) return null;
  if (isNumber(entry.end_ms)) return entry.end_ms;
  const startMs = entryStartMs(entry);
  if (startMs !== null && isNumber(entry.duration_ms)) return startMs + entry.duration_ms;
  return null;
}

function entryDurationMs(entry) {
  return isNumber(entry?.duration_ms) ? entry.duration_ms : null;
}

function durationStats(entries) {
  const durations = entries.map(entryDurationMs).filter((duration) => duration !== null);
  const intervals = entries
    .map((entry) => {
      const start = entryStartMs(entry);
      const end = entryEndMs(entry);
      return start !== null && end !== null && end >= start ? { start, end } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  let occupied = 0;
  let current = null;
  for (const interval of intervals) {
    if (!current) {
      current = { ...interval };
      continue;
    }
    if (interval.start <= current.end) {
      current.end = Math.max(current.end, interval.end);
    } else {
      occupied += current.end - current.start;
      current = { ...interval };
    }
  }
  if (current) occupied += current.end - current.start;

  return {
    duration_ms_observed_count: durations.length,
    duration_ms_sum: durations.length ? durations.reduce((sum, duration) => sum + duration, 0) : null,
    duration_ms_occupied: intervals.length ? occupied : null,
    duration_ms_max: durations.length ? Math.max(...durations) : null,
  };
}

function isInspection(entry) {
  return entry.tool === "git" ? isGitInspection(entry) : isButInspection(entry);
}

function isMutation(entry) {
  return entry.tool === "git" ? isGitMutation(entry) : isButMutation(entry);
}

function isCodexPlatformProbe(entry) {
  if (entry.tool !== "git") return false;
  const { command, args } = vcSubcommand(entry);
  const hasCodexRepoFlags = entry.argv.includes("core.hooksPath=/dev/null") || entry.argv.includes("core.fsmonitor=false");
  const pluginProbe = entry.argv.includes("/.codex/.tmp/plugins")
    || (command === "ls-remote" && /^https:\/\/github\.com\//.test(args[0] ?? ""));

  if (pluginProbe) return true;
  if (!hasCodexRepoFlags) return false;

  if (command === "rev-parse") return true;
  if (command === "remote" && (args[0] === "get-url" || args[0] === "-v")) return true;
  if (command === "status" && args[0] === "--porcelain") return true;
  return false;
}

function isClaudePlatformProbe(entry) {
  if (entry.tool !== "git") return false;
  if (entry.parent !== "claude" && !entry.parent?.endsWith("/claude")) return false;
  const { command, args } = vcSubcommand(entry);

  if (command === "config" && args[0] === "user.name") return true;
  if (command === "config" && args[0] === "--get" && ["user.email", "remote.origin.url"].includes(args[1])) return true;
  if (command === "status" && args.includes("--short")) return true;
  if (command === "log" && args.includes("--oneline") && args.includes("-n") && args.includes("5")) return true;
  if (command === "log" && args.includes("--since=7.days") && entry.argv.includes(".claude/skills .claude/commands")) return true;
  return false;
}

function traceBucket(entry) {
  if (entry.internal) return "tool_internal";
  if (isCodexPlatformProbe(entry)) return "platform";
  if (isClaudePlatformProbe(entry)) return "platform";
  return "task";
}

function summarizeCommands(entries) {
  const vc = entries.filter(isVcEntry);
  const inspections = vc.filter(isInspection);
  const mutations = vc.filter(isMutation);
  const failed = vc.filter((entry) => entry.status !== 0);
  return {
    command_count: entries.length,
    vc_command_count: vc.length,
    git_command_count: vc.filter((entry) => entry.tool === "git").length,
    but_command_count: vc.filter((entry) => entry.tool === "but").length,
    inspection_count: inspections.length,
    mutation_count: mutations.length,
    failed_vc_command_count: failed.length,
    policy_block_count: vc.filter((entry) => entry.status === 42).length,
    read_to_write_ratio: mutations.length > 0 ? inspections.length / mutations.length : null,
    duration: durationStats(entries),
    vc_duration: durationStats(vc),
    inspection_duration: durationStats(inspections),
    mutation_duration: durationStats(mutations),
  };
}

function failedCommandSamples(entries) {
  return entries
    .filter((entry) => entry.status !== 0)
    .slice(0, 10)
    .map((entry) => ({
      bucket: traceBucket(entry),
      tool: entry.tool,
      status: entry.status,
      argv: entry.argv,
    }));
}

function slowestCommands(entries, firstTraceMs, limit = 8) {
  return entries
    .filter((entry) => entryDurationMs(entry) !== null)
    .sort((a, b) => entryDurationMs(b) - entryDurationMs(a))
    .slice(0, limit)
    .map((entry) => ({
      bucket: traceBucket(entry),
      tool: entry.tool,
      status: entry.status,
      duration_ms: entryDurationMs(entry),
      start_offset_ms: offsetMs(entry, firstTraceMs),
      internal: entry.internal,
      argv: entry.argv,
    }));
}

function commandBreakdown(trace) {
  const visible = trace.filter((entry) => !entry.internal);
  const platform = visible.filter((entry) => traceBucket(entry) === "platform");
  const task = visible.filter((entry) => traceBucket(entry) === "task");
  const toolInternal = trace.filter((entry) => traceBucket(entry) === "tool_internal");
  const firstTraceMs = entryStartMs(trace[0]);

  return {
    total_logged_commands: trace.length,
    visible: summarizeCommands(visible),
    platform: summarizeCommands(platform),
    task: summarizeCommands(task),
    tool_internal: summarizeCommands(toolInternal),
    failed_command_samples: failedCommandSamples(trace),
    slowest_observed_commands: slowestCommands(trace, firstTraceMs),
  };
}

function countMatchingLineBytes(text, predicate) {
  return text
    .split(/(?<=\n)/)
    .filter((line) => predicate(line))
    .reduce((sum, line) => sum + Buffer.byteLength(line), 0);
}

function estimateSkillReferenceOutputBytes(text) {
  const lines = text.split(/(?<=\n)/);
  let pendingExec = false;
  let commandReadsSkill = false;
  let inOutput = false;
  let bytes = 0;

  for (const line of lines) {
    if (line === "exec\n") {
      pendingExec = true;
      commandReadsSkill = false;
      inOutput = false;
      continue;
    }

    if (pendingExec) {
      commandReadsSkill = line.includes(".codex/skills/but") || line.includes(".claude/skills/but");
      pendingExec = false;
      continue;
    }

    if (commandReadsSkill && /^\s*succeeded in /.test(line)) {
      inOutput = true;
      continue;
    }

    if (!inOutput) continue;

    if (/^\d{4}-\d{2}-\d{2}T/.test(line) || line === "codex\n" || line === "exec\n" || line === "apply patch\n" || line === "tokens used\n") {
      inOutput = false;
      continue;
    }

    bytes += Buffer.byteLength(line);
  }

  return bytes;
}

function directoryByteLength(dir) {
  if (!existsSync(dir)) return 0;
  const stat = statSync(dir);
  if (stat.isFile()) return stat.size;
  if (!stat.isDirectory()) return 0;
  return readdirSync(dir).reduce((sum, entry) => sum + directoryByteLength(path.join(dir, entry)), 0);
}

function transcriptBreakdown(prompt, agentResult, skillDir) {
  const promptBytes = Buffer.byteLength(prompt);
  const stdoutBytes = Buffer.byteLength(agentResult.stdout);
  const stderrBytes = Buffer.byteLength(agentResult.stderr);
  const totalBytes = promptBytes + stdoutBytes + stderrBytes;
  const platformWarningBytes = countMatchingLineBytes(agentResult.stderr, (line) => line.includes(" WARN codex_"));
  const skillReferenceOutputBytes = estimateSkillReferenceOutputBytes(agentResult.stderr);
  const nonWarningTranscriptBytes = totalBytes - platformWarningBytes;
  const warmEstimatedTotalBytes = Math.max(0, totalBytes - skillReferenceOutputBytes);
  const warmEstimatedNonWarningBytes = Math.max(0, nonWarningTranscriptBytes - skillReferenceOutputBytes);

  return {
    total_bytes: totalBytes,
    prompt_bytes: promptBytes,
    agent_stdout_bytes: stdoutBytes,
    agent_stderr_bytes: stderrBytes,
    platform_warning_bytes: platformWarningBytes,
    skill_reference_output_bytes: skillReferenceOutputBytes,
    cold_start_skill_output_bytes: skillReferenceOutputBytes,
    warm_estimated_total_bytes: warmEstimatedTotalBytes,
    warm_estimated_non_warning_bytes: warmEstimatedNonWarningBytes,
    non_skill_transcript_bytes: warmEstimatedTotalBytes,
    non_warning_transcript_bytes: nonWarningTranscriptBytes,
    available_skill_source_bytes: skillDir ? directoryByteLength(skillDir) : 0,
  };
}

function offsetMs(entry, firstMs) {
  const startMs = entryStartMs(entry);
  return startMs !== null && firstMs !== null ? startMs - firstMs : null;
}

function timingBreakdown(trace, agentResult) {
  const visibleVc = trace.filter((entry) => !entry.internal && isVcEntry(entry));
  const taskVc = visibleVc.filter((entry) => traceBucket(entry) === "task");
  const platformVc = visibleVc.filter((entry) => traceBucket(entry) === "platform");
  const toolInternalVc = trace.filter((entry) => traceBucket(entry) === "tool_internal" && isVcEntry(entry));
  const successfulTaskMutation = taskVc.find((entry) => isMutation(entry) && entry.status === 0);
  const firstTraceMs = entryStartMs(trace[0]);
  const firstTaskVcMs = entryStartMs(taskVc[0]);
  const successfulTaskMutationStartMs = entryStartMs(successfulTaskMutation);
  const successfulTaskMutationEndMs = entryEndMs(successfulTaskMutation);

  return {
    agent_wall_ms: agentResult.duration_ms,
    pre_run_setup_included: false,
    agent_start_to_first_trace_ms: firstTraceMs !== null ? firstTraceMs - agentResult.start_ms : null,
    agent_start_to_first_visible_vc_command_ms: entryStartMs(visibleVc[0]) !== null ? entryStartMs(visibleVc[0]) - agentResult.start_ms : null,
    agent_start_to_first_task_vc_command_ms: firstTaskVcMs !== null ? firstTaskVcMs - agentResult.start_ms : null,
    agent_start_to_first_successful_task_mutation_ms: successfulTaskMutationStartMs !== null
      ? successfulTaskMutationStartMs - agentResult.start_ms
      : null,
    agent_start_to_first_successful_task_mutation_end_ms: successfulTaskMutationEndMs !== null
      ? successfulTaskMutationEndMs - agentResult.start_ms
      : null,
    first_visible_vc_command_offset_ms: offsetMs(visibleVc[0], firstTraceMs),
    first_task_vc_command_offset_ms: offsetMs(taskVc[0], firstTraceMs),
    first_successful_task_mutation_offset_ms: offsetMs(successfulTaskMutation, firstTraceMs),
    first_successful_task_mutation_end_offset_ms: successfulTaskMutationEndMs !== null && firstTraceMs !== null
      ? successfulTaskMutationEndMs - firstTraceMs
      : null,
    first_successful_task_mutation_duration_ms: entryDurationMs(successfulTaskMutation),
    task_time_to_first_successful_mutation_ms: successfulTaskMutationStartMs !== null && firstTaskVcMs !== null
      ? successfulTaskMutationStartMs - firstTaskVcMs
      : null,
    task_time_to_first_successful_mutation_end_ms: successfulTaskMutationEndMs !== null && firstTaskVcMs !== null
      ? successfulTaskMutationEndMs - firstTaskVcMs
      : null,
    observed_command_runtime: {
      all: durationStats(trace),
      visible_vc: durationStats(visibleVc),
      task_vc: durationStats(taskVc),
      platform_vc: durationStats(platformVc),
      tool_internal_vc: durationStats(toolInternalVc),
    },
  };
}

function measurementBreakdown(trace, prompt, agentResult, skillDir) {
  return {
    schema_version: 1,
    timing: timingBreakdown(trace, agentResult),
    transcript: transcriptBreakdown(prompt, agentResult, skillDir),
    commands: commandBreakdown(trace),
  };
}

function traceMetrics(trace, prompt, agentResult) {
  const visible = trace.filter((entry) => !entry.internal);
  const shellCommands = visible.filter((entry) => isShellParent(entry.parent));
  const allVc = visible.filter((entry) => entry.tool === "git" || entry.tool === "but");
  const shellVc = shellCommands.filter((entry) => entry.tool === "git" || entry.tool === "but");
  const vc = allVc;
  const inspections = vc.filter(isInspection);
  const mutations = vc.filter(isMutation);
  const taskVc = vc.filter((entry) => traceBucket(entry) === "task");
  const taskInspections = taskVc.filter(isInspection);
  const taskMutations = taskVc.filter(isMutation);
  const failedVc = vc.filter((entry) => entry.status !== 0);

  let repeatedStateQueries = 0;
  let lastInspection = null;
  for (const entry of vc) {
    const { command } = vcSubcommand(entry);
    if (isMutation(entry)) {
      lastInspection = null;
      continue;
    }
    if (isInspection(entry)) {
      const key = `${entry.tool} ${command}`;
      if (lastInspection === key) repeatedStateQueries++;
      lastInspection = key;
    }
  }

  const firstMutation = mutations.find((entry) => entry.status === 0);
  const firstTraceMs = entryStartMs(vc[0]) ?? entryStartMs(shellCommands[0]) ?? entryStartMs(visible[0]);
  const firstMutationMs = entryStartMs(firstMutation);

  return {
    total_logged_commands: visible.length,
    shell_logged_commands: shellCommands.length,
    shell_vc_command_count: shellVc.length,
    vc_command_count: vc.length,
    vc_inspection_count: inspections.length,
    vc_mutation_count: mutations.length,
    task_vc_command_count: taskVc.length,
    task_vc_inspection_count: taskInspections.length,
    task_vc_mutation_count: taskMutations.length,
    platform_vc_command_count: vc.filter((entry) => traceBucket(entry) === "platform").length,
    tool_internal_vc_command_count: trace.filter((entry) => traceBucket(entry) === "tool_internal" && isVcEntry(entry)).length,
    read_to_write_ratio: mutations.length > 0 ? inspections.length / mutations.length : null,
    task_read_to_write_ratio: taskMutations.length > 0 ? taskInspections.length / taskMutations.length : null,
    parser_command_count: 0,
    repeated_state_queries: repeatedStateQueries,
    failed_vc_commands: failedVc.length,
    task_failed_vc_commands: taskVc.filter((entry) => entry.status !== 0).length,
    platform_failed_vc_commands: vc.filter((entry) => traceBucket(entry) === "platform" && entry.status !== 0).length,
    selector_failure_count: failedVc.filter((entry) => /pathspec|unknown|invalid|not found|ambiguous|failed/i.test(entry.argv)).length,
    time_to_first_successful_mutation_ms: firstMutationMs !== null && firstTraceMs !== null ? firstMutationMs - firstTraceMs : null,
    transcript_bytes: Buffer.byteLength(prompt) + Buffer.byteLength(agentResult.stdout) + Buffer.byteLength(agentResult.stderr),
  };
}

const args = parseArgs(process.argv.slice(2));
const agent = args.get("agent") ?? "codex";
const arm = args.get("arm") ?? "git";
const model = args.get("model") ?? (agent === "codex" ? DEFAULT_CODEX_MODEL : "");
const timeoutMs = Number(args.get("timeout-ms") ?? 900000);
const realBut = path.resolve(args.get("but-bin") ?? commandPath("but"));
const skillDir = path.resolve(args.get("skill-dir") ?? "/Users/kiril/src/gitbutler/crates/but/skill");
const codexCleanConfig = agent === "codex" ? args.get("codex-clean-config") !== "false" : false;
const codexIsolatedHome = agent === "codex" && codexCleanConfig && args.get("codex-isolated-home") !== "false";
const codexDisablePlugins = agent === "codex" && codexCleanConfig && args.get("codex-disable-plugins") !== "false";
const runId = args.get("run-id") ?? `${Date.now()}-${agent}-${arm.replaceAll("+", "-")}`;
const runDir = path.resolve(args.get("out") ?? path.join("tmp/pilot-runs", runId));

if (!["git", "but+skill"].includes(arm)) {
  console.error("Usage: node scripts/run-pilot-agent.mjs --agent <codex|claude> --arm <git|but+skill>");
  process.exit(2);
}

rmSync(runDir, { recursive: true, force: true });
mkdirSync(runDir, { recursive: true });

const { workspace, setup } = prepareWorkspace(runDir, arm, realBut, skillDir);
const { binDir, tracePath } = createWrappers(runDir, arm, realBut);
const codexHome = prepareCodexHome(runDir, codexIsolatedHome);
const prompt = buildPrompt();
writeFileSync(path.join(runDir, "prompt.txt"), prompt);

const env = {
  ...process.env,
  PATH: `${binDir}:${process.env.PATH}`,
  VCB_TRACE: tracePath,
  VCB_CODEX_CLEAN_CONFIG: String(codexCleanConfig),
  VCB_CODEX_DISABLE_PLUGINS: String(codexDisablePlugins),
};
if (codexHome) {
  env.CODEX_HOME = codexHome.path;
}

const agentResult = runAgent(agent, workspace, prompt, env, model, timeoutMs);
writeFileSync(path.join(runDir, "agent-stdout.txt"), agentResult.stdout);
writeFileSync(path.join(runDir, "agent-stderr.txt"), agentResult.stderr);
const observedModel = parseAgentModel(agentResult);

const verifierResult = verify(workspace);
const trace = markImplicitToolInternal(parseTrace(tracePath));
const metrics = traceMetrics(trace, prompt, agentResult);
const measurement = measurementBreakdown(trace, prompt, agentResult, arm === "but+skill" ? skillDir : null);
const runFailureClass = agentResult.timed_out
  ? "AGENT_TIMEOUT"
  : agentResult.status === 0
    ? verifierResult.failure_class
    : "AGENT_RUNTIME_ERROR";

const result = {
  run_id: runId,
  agent,
  arm,
  model: model || null,
  observed_model: observedModel,
  agent_config: {
    codex_clean_config: agent === "codex" ? codexCleanConfig : null,
    codex_ephemeral: agent === "codex" ? codexCleanConfig : null,
    codex_ignore_user_config: agent === "codex" ? codexCleanConfig : null,
    codex_ignore_rules: agent === "codex" ? codexCleanConfig : null,
    codex_isolated_home: agent === "codex" ? codexIsolatedHome : null,
    codex_disable_plugins: agent === "codex" ? codexDisablePlugins : null,
    codex_home: codexHome?.path ?? null,
    codex_auth_copied: codexHome?.auth_copied ?? null,
  },
  workspace,
  task: "pilot-1-selective-validation",
  pre_run_setup: {
    fixture_created_clean: arm === "but+skill",
    gitbutler_setup_before_agent: arm === "but+skill",
    skill_installed_before_agent: arm === "but+skill",
    agent_instructions_before_agent: true,
    dirty_state_applied_before_agent: true,
    included_in_agent_duration_or_metrics: false,
  },
  agent_instructions: setup.instructions,
  but_binary: arm === "but+skill" ? realBut : null,
  skill: arm === "but+skill"
    ? {
        source_dir: skillDir,
        version: parseSkillVersion(path.join(skillDir, "SKILL.md")),
        installed_codex: path.join(workspace, ".codex/skills/but/SKILL.md"),
        installed_claude: path.join(workspace, ".claude/skills/but/SKILL.md"),
      }
    : null,
  agent_result: {
    status: agentResult.status,
    signal: agentResult.signal,
    timed_out: agentResult.timed_out,
    start_ms: agentResult.start_ms,
    end_ms: agentResult.end_ms,
    duration_ms: agentResult.duration_ms,
    error: agentResult.error,
    cmd: agentResult.cmd,
    args: agentResult.args,
  },
  verifier: verifierResult,
  run_failure_class: runFailureClass,
  metrics,
  measurement,
};

writeFileSync(path.join(runDir, "result.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exit(agentResult.status === 0 && verifierResult.passed ? 0 : 1);
