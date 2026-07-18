#!/usr/bin/env node
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs } from "./lib/args.mjs";
import { run } from "./lib/process.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const DEFAULT_CODEX_MODEL = "gpt-5.5";
// Versioned model ID, not the floating `opus` alias: reruns of a published
// batch must hit the same model. Current-generation Claude models have no
// dated snapshots; the versioned ID is the pin. Override with --model.
const DEFAULT_CLAUDE_MODEL = "claude-opus-4-8";
const DEFAULT_JJ_SKILL = {
  package: "onevcat/skills@onevcat-jj",
  name: "onevcat-jj",
  // Pinned to the last upstream commit touching the skill so runs are
  // reproducible; the fetched bytes are verified against expected_sha256.
  source_rev: "4955f5422d992db58ddb3652ec1c1b552405b39d",
  source_url: "https://raw.githubusercontent.com/onevcat/skills/4955f5422d992db58ddb3652ec1c1b552405b39d/skills/onevcat-jj/SKILL.md",
  expected_sha256: "e0364004187a1769adc0b532befe346fd4b372bb1aab2768b9ebb694f2d13687",
  selection_note: "Top direct jj result from `npx skills find jj` on 2026-06-29; the skills CLI showed 279 installs.",
};

const TASK_CONFIGS = {
  "pilot-1-selective-validation": {
    id: "pilot-1-selective-validation",
    taskDir: "tasks/pilot-1-selective-validation",
    createFixtureScript: "scripts/create-pilot-fixture.mjs",
    applyStateScript: "scripts/apply-pilot-state.mjs",
    verifyScript: "scripts/verify-pilot.mjs",
    gitbutlerPrep: "setup",
  },
  "pilot-2-multi-amend": {
    id: "pilot-2-multi-amend",
    taskDir: "tasks/pilot-2-multi-amend",
    createFixtureScript: "scripts/create-pilot2-fixture.mjs",
    applyStateScript: "scripts/apply-pilot2-state.mjs",
    verifyScript: "scripts/verify-pilot2.mjs",
    gitbutlerPrep: "setup-and-apply-branch",
    applyBranch: "amend-series",
  },
  "pilot-3-split-commit": {
    id: "pilot-3-split-commit",
    taskDir: "tasks/pilot-3-split-commit",
    createFixtureScript: "scripts/create-pilot3-fixture.mjs",
    applyStateScript: "scripts/apply-pilot3-state.mjs",
    verifyScript: "scripts/verify-pilot3.mjs",
    gitbutlerPrep: "setup-and-apply-branch",
    applyBranch: "split-workflow",
    fixtureDirty: false,
    applyDirtyState: false,
  },
  "pilot-4-reorder-commits": {
    id: "pilot-4-reorder-commits",
    taskDir: "tasks/pilot-4-reorder-commits",
    createFixtureScript: "scripts/create-pilot4-fixture.mjs",
    verifyScript: "scripts/verify-pilot4.mjs",
    gitbutlerPrep: "setup-and-apply-branch",
    applyBranch: "reorder-series",
    fixtureDirty: false,
    applyDirtyState: false,
  },
  "pilot-5-squash-commits": {
    id: "pilot-5-squash-commits",
    taskDir: "tasks/pilot-5-squash-commits",
    createFixtureScript: "scripts/create-pilot5-fixture.mjs",
    verifyScript: "scripts/verify-pilot5.mjs",
    gitbutlerPrep: "setup-and-apply-branch",
    applyBranch: "squash-series",
    fixtureDirty: false,
    applyDirtyState: false,
  },
  "pilot-6-update-dirty-branch": {
    id: "pilot-6-update-dirty-branch",
    taskDir: "tasks/pilot-6-update-dirty-branch",
    createFixtureScript: "scripts/create-pilot6-fixture.mjs",
    applyStateScript: "scripts/apply-pilot6-state.mjs",
    verifyScript: "scripts/verify-pilot6.mjs",
    gitbutlerPrep: "setup-and-apply-branch",
    applyBranch: "notify-retry",
  },
};

let taskConfig;
let taskDir;

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

const JJ_MUTATIONS = new Set([
  "abandon",
  "absorb",
  "commit",
  "describe",
  "desc",
  "duplicate",
  "edit",
  "new",
  "rebase",
  "resolve",
  "restore",
  "split",
  "squash",
  "undo",
]);

const JJ_INSPECTIONS = new Set(["diff", "log", "show", "status", "st", "evolog"]);

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function commandPath(command) {
  const result = spawnSync("bash", ["-lc", `command -v ${shellQuote(command)} || true`], {
    encoding: "utf8",
  });
  return result.stdout.trim();
}

function executablePath(value, fallbackCommand) {
  const candidate = value ?? commandPath(fallbackCommand);
  if (!candidate) {
    throw new Error(`Could not find required executable: ${fallbackCommand}`);
  }
  if (!value || candidate.includes("/") || path.isAbsolute(candidate)) {
    return path.resolve(candidate);
  }
  const found = commandPath(candidate);
  if (!found) {
    throw new Error(`Could not find required executable: ${candidate}`);
  }
  return path.resolve(found);
}

function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function sortedDirectoryFiles(dir) {
  return readdirSync(dir)
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) return sortedDirectoryFiles(fullPath);
      if (stat.isFile()) return [fullPath];
      return [];
    })
    .sort();
}

function sha256Directory(dir) {
  const hash = createHash("sha256");
  for (const filePath of sortedDirectoryFiles(dir)) {
    hash.update(path.relative(dir, filePath).split(path.sep).join("/"));
    hash.update("\0");
    hash.update(readFileSync(filePath));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function nearestGitRoot(targetPath) {
  let dir = statSync(targetPath).isDirectory() ? targetPath : path.dirname(targetPath);
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, ".git"))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function gitOutputOrNull(root, args) {
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.trimEnd();
}

function gitSourceInfo(targetPath, { scope = "path" } = {}) {
  const root = nearestGitRoot(targetPath);
  if (!root) return null;

  const relativePath = path.relative(root, targetPath);
  const statusArgs = scope === "repo"
    ? ["status", "--short"]
    : ["status", "--short", "--", relativePath];
  const statusShort = gitOutputOrNull(root, statusArgs) ?? "";

  return {
    root,
    head: gitOutputOrNull(root, ["rev-parse", "HEAD"]),
    dirty: statusShort.length > 0,
    status_short: statusShort,
  };
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

function prepareClaudeSettings(runDir, enabled, effortLevel) {
  if (!enabled) return null;

  const settingsPath = path.join(runDir, "claude-settings.json");
  const settings = {
    permissions: {
      defaultMode: "bypassPermissions",
    },
    enabledPlugins: {},
  };
  if (effortLevel) {
    settings.effortLevel = effortLevel;
  }
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  return {
    path: settingsPath,
    settings,
  };
}

function prepareClaudeConfig(enabled) {
  if (!enabled) return null;

  const configDir = mkdtempSync(path.join(tmpdir(), "vcb-claude-config-"));
  chmodSync(configDir, 0o700);
  const sourceConfigDir = process.env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), ".claude");
  const sourceCredentialsPath = path.join(sourceConfigDir, ".credentials.json");
  let oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN ?? null;
  let authSource = oauthToken ? "environment" : null;
  let credentialsJson = null;

  if (!oauthToken && existsSync(sourceCredentialsPath)) {
    credentialsJson = readFileSync(sourceCredentialsPath, "utf8");
    authSource = "credentials-file";
  } else if (!oauthToken && process.platform === "darwin") {
    const keychainCredentials = run(
      "security",
      ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
      { check: false },
    );
    if (keychainCredentials.status === 0 && keychainCredentials.stdout.trim()) {
      credentialsJson = keychainCredentials.stdout.trim();
      authSource = "macos-keychain";
    }
  }

  if (!oauthToken && credentialsJson) {
    try {
      oauthToken = JSON.parse(credentialsJson)?.claudeAiOauth?.accessToken ?? null;
    } catch {
      oauthToken = null;
    }
  }

  if (!oauthToken) {
    rmSync(configDir, { recursive: true, force: true });
    throw new Error("Could not prepare isolated Claude OAuth from the environment, configured credentials file, or macOS Keychain");
  }

  return {
    path: configDir,
    auth_source: authSource,
    oauth_token: oauthToken,
    cleanup: () => rmSync(configDir, { recursive: true, force: true }),
  };
}

function writeWrapper(binDir, tool, realPath, tracePath, arm) {
  const wrapperPath = path.join(binDir, tool);
  const blockGitWrites = tool === "git" && ["but+skill", "jj+skill"].includes(arm);
  const blockBut = tool === "but" && arm !== "but+skill";
  const blockJj = tool === "jj" && arm !== "jj+skill";
  const mutationList = [...GIT_MUTATIONS].filter((command) => command !== "branch").join("|");

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
if [[ "$TOOL" == "git" && ( "$PARENT" == *but* || "$GRANDPARENT" == *but* || "$PARENT" == *jj* || "$GRANDPARENT" == *jj* ) ]]; then
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
if [[ ${blockJj ? "true" : "false"} == true ]]; then
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
    branch)
      BRANCH_READ=false
      if [[ $# -eq $((IDX + 1)) ]]; then
        BRANCH_READ=true
      fi
      for ((ARG_INDEX = IDX + 1; ARG_INDEX < $#; ARG_INDEX++)); do
        case "\${ARGS[$ARG_INDEX]}" in
          --list|--show-current) BRANCH_READ=true ;;
        esac
      done
      if [[ "$BRANCH_READ" != true ]]; then
        POLICY_BLOCK=true
      fi
      ;;
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

function createWrappers(runDir, arm, realBut, realJj) {
  const binDir = path.join(runDir, "bin");
  mkdirSync(binDir, { recursive: true });
  const tracePath = path.join(runDir, "command-trace.tsv");
  writeFileSync(tracePath, "");

  const realGit = commandPath("git");
  writeWrapper(binDir, "git", realGit, tracePath, arm);
  writeWrapper(binDir, "but", realBut, tracePath, arm);
  writeWrapper(binDir, "jj", realJj, tracePath, arm);

  return { binDir, tracePath };
}

function parseSkillVersion(skillFile) {
  const content = readFileSync(skillFile, "utf8");
  const match = content.match(/^version:\s*"?([^"\n]+)"?\s*$/m);
  return match?.[1] ?? null;
}

function parseSkillName(skillFile) {
  const content = readFileSync(skillFile, "utf8");
  const match = content.match(/^name:\s*"?([^"\n]+)"?\s*$/m);
  return match?.[1] ?? null;
}

function renderGitButlerInstructions(workspace, realBut, codexSkillPath, claudeSkillPath, butEnv) {
  const setupBlock = run(realBut, ["agent", "setup", "--print"], { cwd: workspace, env: butEnv }).stdout.trimEnd();
  const content = `# AGENTS.md

## Benchmark boundary

Work only in the current repository. Do not inspect parent benchmark directories, hidden oracle files, or solution scripts.

## Local skill

The official GitButler CLI skill is installed for this benchmark trial at:

- ${codexSkillPath}
- ${claudeSkillPath}

Use the installed skill if your agent runtime loads local skills or you need GitButler command details.

${setupBlock}
`;

  return {
    content,
    setup_block: setupBlock,
    setup_block_sha256: sha256Text(setupBlock),
  };
}

function renderJjInstructions(workspace, realJj, codexSkillPath, claudeSkillPath, sourceMetadata) {
  const version = run(realJj, ["--version"], { cwd: workspace }).stdout.trimEnd();
  const policyBlock = `## Version control

- Use Jujutsu (\`jj\`) for version-control write operations in this benchmark trial.
- The repository was prepared with \`jj git init --colocate\`; Git-visible refs still matter to the verifier.
- Do not use raw \`git\` writes or GitButler (\`but\`) in this benchmark trial.
- Read-only Git inspection is allowed if it helps you verify Git-visible state.
- Always pass \`--no-pager\` to jj commands that may print long output.
- Always pass \`-m\` / \`--message\` to jj commands that need descriptions; do not open an editor.
- Keep bookmarks updated for any named task branch so the final Git branch points at the requested history.
- When the task asks to leave changes uncommitted, leave them in the working-copy commit \`@\`.
`;

  const content = `# AGENTS.md

## Benchmark boundary

Work only in the current repository. Do not inspect parent benchmark directories, hidden oracle files, or solution scripts.

## Local skill

The local Jujutsu CLI skill is installed for this benchmark trial at:

- ${codexSkillPath}
- ${claudeSkillPath}

Skill source: ${sourceMetadata.package ?? sourceMetadata.source_url ?? "external source"}.

Use the installed skill if your agent runtime loads local skills or you need Jujutsu command details.

${policyBlock}
`;

  return {
    content,
    version,
    setup_block: policyBlock.trimEnd(),
    setup_block_sha256: sha256Text(policyBlock.trimEnd()),
  };
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

function installGitButlerSkill(workspace, skillDir, realBut, butEnv) {
  const skillFile = path.join(skillDir, "SKILL.md");
  if (!existsSync(skillFile)) {
    throw new Error(`GitButler skill file not found: ${skillFile}`);
  }

  const refsDir = path.join(skillDir, "references");
  const installed = [];
  const cliVersionOutput = run(realBut, ["--version"], { cwd: workspace, env: butEnv }).stdout.trim();
  const cliVersion = /^but\s+(\S+)(?:\s|$)/.exec(cliVersionOutput)?.[1];
  if (!cliVersion) {
    throw new Error(`Could not parse GitButler CLI version from: ${JSON.stringify(cliVersionOutput)}`);
  }
  const sourceSkillContent = readFileSync(skillFile, "utf8");
  const frontmatter = /^---\r?\n[\s\S]*?\r?\n---/.exec(sourceSkillContent)?.[0];
  if (!frontmatter) {
    throw new Error(`GitButler skill source does not contain YAML frontmatter: ${skillFile}`);
  }
  const installedFrontmatter = frontmatter.replace(
    /^version:\s*0\.0\.0\s*$/m,
    `version: ${cliVersion}`,
  );
  if (installedFrontmatter === frontmatter) {
    throw new Error(`GitButler skill source does not contain the expected placeholder version: ${skillFile}`);
  }
  const installedSkillContent = installedFrontmatter + sourceSkillContent.slice(frontmatter.length);

  for (const root of [".codex/skills/gitbutler", ".claude/skills/gitbutler"]) {
    const dest = path.join(workspace, root);
    mkdirSync(dest, { recursive: true });
    writeFileSync(path.join(dest, "SKILL.md"), installedSkillContent);
    if (existsSync(refsDir)) {
      cpSync(refsDir, path.join(dest, "references"), { recursive: true });
    }
    installed.push(dest);
  }

  const codexSkillPath = path.join(workspace, ".codex/skills/gitbutler/SKILL.md");
  const claudeSkillPath = path.join(workspace, ".claude/skills/gitbutler/SKILL.md");
  const instructions = renderGitButlerInstructions(workspace, realBut, codexSkillPath, claudeSkillPath, butEnv);
  writeAgentInstructionFiles(workspace, instructions.content);

  appendHarnessExclude(workspace);

  return {
    name: parseSkillName(skillFile) ?? "but",
    install_name: "gitbutler",
    source_dir: skillDir,
    version: cliVersion,
    installed,
    instructions: {
      installed_codex: path.join(workspace, "AGENTS.md"),
      installed_claude: path.join(workspace, "CLAUDE.md"),
      source_url: "https://docs.gitbutler.com/ai-agents/getting-started#add-optional-agent-instructions",
      source_command: "but agent setup --print",
      setup_block_sha256: instructions.setup_block_sha256,
    },
  };
}

function fetchJjSkillSource(runDir, sourceMetadata) {
  const dest = path.join(runDir, "external-skills", sourceMetadata.name);
  const skillFile = path.join(dest, "SKILL.md");
  mkdirSync(dest, { recursive: true });

  const fetched = run("curl", ["-fsSL", sourceMetadata.source_url], { cwd: repoRoot, check: false });
  if (fetched.status !== 0 || !fetched.stdout.trim()) {
    throw new Error(`Failed to fetch jj skill from ${sourceMetadata.source_url}\n${fetched.stderr}`);
  }

  if (sourceMetadata.expected_sha256) {
    const actual = sha256Text(fetched.stdout);
    if (actual !== sourceMetadata.expected_sha256) {
      throw new Error(
        `jj skill integrity check failed for ${sourceMetadata.source_url}\n` +
          `expected sha256 ${sourceMetadata.expected_sha256}\n` +
          `actual   sha256 ${actual}\n` +
          `Pass --jj-skill-sha256 (or --jj-skill-sha256 none) when intentionally using different skill content.`,
      );
    }
  }

  writeFileSync(skillFile, fetched.stdout);
  return {
    dir: dest,
    source: {
      ...sourceMetadata,
      fetched_at: new Date().toISOString(),
    },
  };
}

function resolveJjSkillSource(runDir, configuredDir, sourceMetadata) {
  if (configuredDir) {
    return {
      dir: configuredDir,
      source: {
        ...sourceMetadata,
        configured_dir: configuredDir,
      },
    };
  }

  return fetchJjSkillSource(runDir, sourceMetadata);
}

function installJjSkill(workspace, skillDir, realJj, sourceMetadata) {
  const skillFile = path.join(skillDir, "SKILL.md");
  if (!existsSync(skillFile)) {
    throw new Error(`Jujutsu skill file not found: ${skillFile}`);
  }

  const refsDir = path.join(skillDir, "references");
  const installed = [];
  const skillName = parseSkillName(skillFile) ?? sourceMetadata.name ?? path.basename(skillDir);

  for (const root of [`.codex/skills/${skillName}`, `.claude/skills/${skillName}`]) {
    const dest = path.join(workspace, root);
    mkdirSync(dest, { recursive: true });
    cpSync(skillFile, path.join(dest, "SKILL.md"));
    if (existsSync(refsDir)) {
      cpSync(refsDir, path.join(dest, "references"), { recursive: true });
    }
    installed.push(dest);
  }

  const codexSkillPath = path.join(workspace, `.codex/skills/${skillName}/SKILL.md`);
  const claudeSkillPath = path.join(workspace, `.claude/skills/${skillName}/SKILL.md`);
  const instructions = renderJjInstructions(workspace, realJj, codexSkillPath, claudeSkillPath, sourceMetadata);
  writeAgentInstructionFiles(workspace, instructions.content);

  appendHarnessExclude(workspace);

  return {
    name: skillName,
    source_dir: skillDir,
    source: sourceMetadata,
    version: parseSkillVersion(skillFile),
    installed,
    instructions: {
      installed_codex: path.join(workspace, "AGENTS.md"),
      installed_claude: path.join(workspace, "CLAUDE.md"),
      source_package: sourceMetadata.package ?? null,
      source_url: sourceMetadata.source_url ?? null,
      source_command: "jj --version",
      setup_block_sha256: instructions.setup_block_sha256,
      tool_version: instructions.version,
    },
  };
}

function prepareWorkspace(runDir, arm, realBut, butSkillDir, realJj, jjSkill, butEnv) {
  const workspace = path.join(runDir, "workspace");
  const dirty = arm === "git" && taskConfig.fixtureDirty !== false;
  run("node", [path.join(repoRoot, taskConfig.createFixtureScript), "--out", workspace, "--force", "true", "--dirty", String(dirty)], {
    cwd: repoRoot,
  });

  if (arm === "but+skill") {
    if (taskConfig.gitbutlerPrep === "setup-and-apply-branch") {
      run("git", ["switch", "main"], { cwd: workspace, stdio: "pipe" });
    }
    run(realBut, ["setup"], { cwd: workspace, stdio: "pipe", env: butEnv });
    if (taskConfig.gitbutlerPrep === "setup-and-apply-branch") {
      run(realBut, ["apply", taskConfig.applyBranch], { cwd: workspace, stdio: "pipe", env: butEnv });
    }
    const setup = installGitButlerSkill(workspace, butSkillDir, realBut, butEnv);
    if (taskConfig.applyDirtyState !== false) {
      run("node", [path.join(repoRoot, taskConfig.applyStateScript), "dirty", workspace], { cwd: repoRoot });
    }
    return { workspace, setup };
  }

  if (arm === "jj+skill") {
    run(realJj, ["git", "init", "--colocate"], { cwd: workspace, stdio: "pipe" });
    run(realJj, ["config", "set", "--repo", "ui.paginate", "never"], { cwd: workspace, stdio: "pipe" });
    const setup = installJjSkill(workspace, jjSkill.dir, realJj, jjSkill.source);
    if (taskConfig.applyDirtyState !== false) {
      run("node", [path.join(repoRoot, taskConfig.applyStateScript), "dirty", workspace], { cwd: repoRoot });
    }
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

function agentCliVersion(agent) {
  const cmd = agent === "codex" ? "codex" : "claude";
  const probe = run(cmd, ["--version"], { check: false });
  if (probe.status !== 0) return null;
  return `${probe.stdout}${probe.stderr}`.trim().split("\n")[0] || null;
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
    args = ["-p", "--permission-mode", "bypassPermissions", "--output-format", "json"];
    if (env.VCB_CLAUDE_CLEAN_CONFIG === "true" && env.VCB_CLAUDE_SETTINGS) {
      args.push(
        "--settings",
        env.VCB_CLAUDE_SETTINGS,
        "--setting-sources",
        "project,local",
        "--strict-mcp-config",
      );
    }
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

function parseJsonObject(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function usageTokenTotal(usage) {
  if (!usage || typeof usage !== "object") return 0;
  return [
    "inputTokens",
    "outputTokens",
    "cacheReadInputTokens",
    "cacheCreationInputTokens",
    "webSearchRequests",
  ].reduce((sum, key) => {
    const value = usage[key];
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function primaryModelFromUsage(modelUsage) {
  if (!modelUsage || typeof modelUsage !== "object") return null;
  const entries = Object.entries(modelUsage)
    .map(([model, usage]) => ({
      model,
      cost: Number.isFinite(usage?.costUSD) ? usage.costUSD : 0,
      tokens: usageTokenTotal(usage),
    }))
    .sort((a, b) => (b.cost - a.cost) || (b.tokens - a.tokens) || a.model.localeCompare(b.model));

  return entries[0]?.model ?? null;
}

// Codex prints a trailing "tokens used\n<n,nnn>" block on stderr.
function parseCodexTokensUsed(stderr) {
  const matches = [...stderr.matchAll(/tokens used\s*[\r\n]+\s*([\d,]+)/gi)];
  const value = matches.at(-1)?.[1];
  return value ? Number(value.replaceAll(",", "")) : null;
}

// Totals are comparable across runs of the same agent, not across agents:
// each CLI decides for itself what counts as a used token (e.g. cache reads).
function claudeTokensUsed(parsed) {
  const sumKeys = (usage, keys) =>
    keys.reduce((sum, key) => sum + (Number.isFinite(usage?.[key]) ? usage[key] : 0), 0);

  if (parsed.modelUsage && typeof parsed.modelUsage === "object") {
    const total = Object.values(parsed.modelUsage).reduce(
      (sum, usage) => sum + sumKeys(usage, ["inputTokens", "outputTokens", "cacheReadInputTokens", "cacheCreationInputTokens"]),
      0,
    );
    if (total > 0) return total;
  }

  const total = sumKeys(parsed.usage, ["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"]);
  return total > 0 ? total : null;
}

function parseAgentOutput(agent, agentResult) {
  if (agent !== "claude") {
    return {
      output_format: "text",
      observed_model: parseAgentModel(agentResult),
      observed_model_source: "stderr",
      tokens_used_total: parseCodexTokensUsed(agentResult.stderr),
      transcript_stdout: agentResult.stdout,
    };
  }

  const parsed = parseJsonObject(agentResult.stdout);
  if (!parsed) {
    return {
      output_format: "json",
      parse_error: true,
      observed_model: parseAgentModel(agentResult),
      observed_model_source: "stderr",
      transcript_stdout: agentResult.stdout,
    };
  }

  return {
    output_format: "json",
    parse_error: false,
    observed_model: primaryModelFromUsage(parsed.modelUsage) ?? parseAgentModel(agentResult),
    observed_model_source: parsed.modelUsage ? "modelUsage" : "stderr",
    transcript_stdout: typeof parsed.result === "string" ? parsed.result : "",
    result_text_bytes: typeof parsed.result === "string" ? Buffer.byteLength(parsed.result) : 0,
    type: parsed.type ?? null,
    subtype: parsed.subtype ?? null,
    is_error: parsed.is_error ?? null,
    stop_reason: parsed.stop_reason ?? null,
    session_id: parsed.session_id ?? null,
    total_cost_usd: parsed.total_cost_usd ?? null,
    tokens_used_total: claudeTokensUsed(parsed),
    usage: parsed.usage ?? null,
    model_usage: parsed.modelUsage ?? null,
    errors: parsed.errors ?? null,
    permission_denials: parsed.permission_denials ?? null,
  };
}

function agentResultForTranscript(agentResult, agentOutput) {
  return {
    ...agentResult,
    stdout: agentOutput.transcript_stdout ?? agentResult.stdout,
  };
}

function verify(workspace) {
  const result = run("node", [path.join(repoRoot, taskConfig.verifyScript), "--repo", workspace, "--task", taskDir], {
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
      const overlaps = start !== null && end !== null && butStart !== null && butEnd !== null && start >= butStart && end <= butEnd;
      const immediatelyPrecedes = end !== null && butStart !== null && end <= butStart && butStart - end <= 250;
      return overlaps || immediatelyPrecedes;
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

  if (entry.tool === "jj") {
    while (i < parts.length) {
      const part = parts[i];
      if (["-R", "--repository", "--config", "--config-file", "--at-operation", "--at-op", "--color"].includes(part)) {
        i += 2;
        continue;
      }
      if (part.startsWith("--repository=")
        || part.startsWith("--config=")
        || part.startsWith("--config-file=")
        || part.startsWith("--at-operation=")
        || part.startsWith("--at-op=")
        || part.startsWith("--color=")) {
        i += 1;
        continue;
      }
      if (["--no-pager", "--quiet", "--ignore-working-copy", "--ignore-immutable", "--debug"].includes(part)) {
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

function isJjInspection(entry) {
  const { command, args } = vcSubcommand(entry);
  if (args.includes("--help") || args.includes("-h") || command === "help") return true;
  if (JJ_INSPECTIONS.has(command)) return true;
  if (command === "bookmark") return args[0] === "list";
  if (command === "file") return ["list", "show", "search", "annotate"].includes(args[0]);
  if (command === "git") return ["remote"].includes(args[0]);
  if (command === "op") return ["log", "show"].includes(args[0]);
  return false;
}

function isJjMutation(entry) {
  const { command, args } = vcSubcommand(entry);
  if (args.includes("--help") || args.includes("-h") || command === "help") return false;
  if (JJ_MUTATIONS.has(command)) return true;
  if (command === "bookmark") return args[0] !== "list";
  if (command === "file") return ["untrack"].includes(args[0]);
  if (command === "git") return ["init", "clone", "fetch", "push", "import", "export"].includes(args[0]);
  if (command === "op") return ["restore", "abandon"].includes(args[0]);
  return false;
}

function isShellParent(parent) {
  if (!parent) return false;
  return ["sh", "bash", "zsh", "/bin/sh", "/bin/bash", "/bin/zsh"].some((shell) => parent === shell || parent.endsWith(`/${shell}`));
}

function isVcEntry(entry) {
  return entry.tool === "git" || entry.tool === "but" || entry.tool === "jj";
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
  if (entry.tool === "git") return isGitInspection(entry);
  if (entry.tool === "but") return isButInspection(entry);
  if (entry.tool === "jj") return isJjInspection(entry);
  return false;
}

function isMutation(entry) {
  if (entry.tool === "git") return isGitMutation(entry);
  if (entry.tool === "but") return isButMutation(entry);
  if (entry.tool === "jj") return isJjMutation(entry);
  return false;
}

function isCodexPlatformProbe(entry) {
  if (entry.tool !== "git") return false;
  const { command, args } = vcSubcommand(entry);
  const codexParent = entry.parent === "codex" || entry.parent?.endsWith("/codex") || entry.parent?.includes("/codex/");
  const fsmonitorProbe = codexParent
    && command === "config"
    && args[0] === "--null"
    && args[1] === "--get"
    && args[2] === "core.fsmonitor";
  const hasCodexRepoFlags = entry.argv.includes("core.hooksPath=/dev/null") || entry.argv.includes("core.fsmonitor=false");
  const pluginProbe = entry.argv.includes("/.codex/.tmp/plugins")
    || (command === "ls-remote" && /^https:\/\/github\.com\//.test(args[0] ?? ""));

  if (fsmonitorProbe) return true;
  if (pluginProbe) return true;
  if (!hasCodexRepoFlags) return false;

  if (command === "rev-parse") return true;
  if (command === "remote" && (args[0] === "get-url" || args[0] === "-v")) return true;
  if (command === "status" && args[0] === "--porcelain") return true;
  return false;
}

function processNameMatches(name, processName) {
  return name === processName || name?.endsWith(`/${processName}`);
}

function isClaudeCodeProbeProcess(entry) {
  const parentIsClaude = processNameMatches(entry.parent, "claude");
  const parentIsNode = processNameMatches(entry.parent, "node");
  const grandparentIsNode = processNameMatches(entry.grandparent, "node");

  return (parentIsClaude && grandparentIsNode) || (parentIsNode && grandparentIsNode);
}

function isClaudeShellProbeProcess(entry) {
  return isShellParent(entry.parent) && processNameMatches(entry.grandparent, "claude");
}

function isClaudeHistoryScan(command, args, entry) {
  if (
    command === "log"
    && args.includes("-n")
    && args.includes("1000")
    && args.includes("--pretty=format:")
    && args.includes("--name-only")
    && args.includes("--diff-filter=M")
  ) return true;

  return command === "log" && args.includes("--since=7.days") && entry.argv.includes(".claude/skills .claude/commands");
}

function isClaudePlatformProbe(entry) {
  if (entry.tool !== "git") return false;
  const { command, args } = vcSubcommand(entry);
  const shellEmailProbe = command === "config"
    && args.join(" ") === "user.email"
    && isShellParent(entry.parent)
    && isShellParent(entry.grandparent);
  if (shellEmailProbe) return true;

  if (isClaudeShellProbeProcess(entry) && isClaudeHistoryScan(command, args, entry)) return true;
  if (!isClaudeCodeProbeProcess(entry)) return false;

  if (command === "config" && args[0] === "user.name") return true;
  if (command === "config" && args[0] === "user.email") return true;
  if (command === "config" && args[0] === "--get" && ["user.email", "remote.origin.url"].includes(args[1])) return true;
  if (command === "remote" && (args.length === 0 || args[0] === "get-url" || args[0] === "-v")) return true;
  if (command === "ls-files" && args.includes("--error-unmatch") && entry.argv.includes(".claude/")) return true;
  if (command === "rev-parse" && args.join(" ") === "--show-toplevel") return true;
  if (command === "rev-parse" && args.join(" ") === "--is-inside-work-tree") return true;
  if (command === "rev-parse" && args.join(" ") === "--abbrev-ref HEAD") return true;
  if (command === "rev-parse" && args.join(" ") === "--abbrev-ref origin/HEAD") return true;
  if (command === "branch" && args.join(" ") === "--show-current") return true;
  if (command === "status" && args.includes("--short")) return true;
  if (command === "log" && args.includes("--oneline") && args.includes("-n") && args.includes("5")) return true;
  if (isClaudeHistoryScan(command, args, entry)) return true;
  return false;
}

function traceBucket(entry) {
  if (entry.internal) return "tool_internal";
  if (isCodexPlatformProbe(entry)) return "platform";
  if (isClaudePlatformProbe(entry)) return "platform";
  return "task";
}

function runMetricsSelfTest() {
  const base = {
    schema: "v2",
    start_ms: 0,
    end_ms: 1,
    duration_ms: 1,
    ts: 0,
    tool: "git",
    status: 0,
    cwd: "/tmp/repo",
    parent: "claude",
    grandparent: "node",
    internal: false,
  };

  const cases = [
    ["platform", { ...base, argv: "rev-parse --show-toplevel", parent: "node", grandparent: "node" }],
    ["platform", { ...base, argv: "rev-parse --is-inside-work-tree" }],
    ["platform", { ...base, status: 42, argv: "branch --show-current" }],
    ["platform", { ...base, status: 128, argv: "rev-parse --abbrev-ref origin/HEAD" }],
    ["platform", { ...base, argv: "rev-parse --abbrev-ref HEAD" }],
    ["platform", { ...base, parent: "/bin/sh", grandparent: "/bin/sh", argv: "config user.email" }],
    ["platform", { ...base, parent: "/bin/sh", grandparent: "claude", argv: "log -n 1000 --pretty=format: --name-only --diff-filter=M --author=bench@example.com" }],
    ["platform", { ...base, parent: "/bin/sh", grandparent: "claude", argv: "log -n 1000 --pretty=format: --name-only --diff-filter=M" }],
    ["platform", { ...base, status: 1, argv: "-c core.hooksPath=/dev/null -c core.fsmonitor= -C /tmp/repo ls-files --error-unmatch -- :(icase).claude/settings.local.json" }],
    ["platform", { ...base, argv: "-c core.hooksPath=/dev/null -c core.fsmonitor= remote" }],
    ["platform", { ...base, status: 2, argv: "-c core.hooksPath=/dev/null -c core.fsmonitor= remote get-url origin" }],
    ["task", { ...base, argv: "ls-files --error-unmatch -- src/handler.ts" }],
    ["task", { ...base, parent: "/bin/sh", grandparent: "claude", argv: "status --short" }],
    ["task", { ...base, parent: "/bin/sh", grandparent: "claude", argv: "rev-parse --abbrev-ref HEAD" }],
    ["task", { ...base, parent: "/bin/sh", grandparent: "claude", argv: "diff -- src/handler.ts" }],
    ["task", { ...base, tool: "but", parent: "/bin/zsh", grandparent: "claude", argv: "diff" }],
  ];

  const failures = cases
    .map(([expected, entry], index) => ({ index, expected, actual: traceBucket(entry), entry }))
    .filter((result) => result.actual !== result.expected);

  const implicitTrace = markImplicitToolInternal([
    {
      ...base,
      start_ms: 100,
      end_ms: 130,
      duration_ms: 30,
      parent: "/bin/sh",
      grandparent: "/bin/sh",
      argv: "symbolic-ref --short HEAD",
    },
    {
      ...base,
      tool: "but",
      start_ms: 250,
      end_ms: 500,
      duration_ms: 250,
      parent: "/bin/zsh",
      grandparent: "claude",
      argv: "commit input-validation -c -m Add --changes a1",
    },
  ]);

  if (!implicitTrace[0].internal) {
    failures.push({
      index: "implicit-symbolic-ref",
      expected: "tool_internal",
      actual: traceBucket(implicitTrace[0]),
      entry: implicitTrace[0],
    });
  }

  if (failures.length) {
    console.error(JSON.stringify({ passed: false, failures }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ passed: true, cases: cases.length + 1 }, null, 2));
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
    jj_command_count: vc.filter((entry) => entry.tool === "jj").length,
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

function estimateSkillReferenceOutputBytes(text, skillName) {
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
      commandReadsSkill = Boolean(skillName)
        && (line.includes(`.codex/skills/${skillName}`) || line.includes(`.claude/skills/${skillName}`));
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

function transcriptBreakdown(prompt, agentResult, skillDir, skillName) {
  const promptBytes = Buffer.byteLength(prompt);
  const stdoutBytes = Buffer.byteLength(agentResult.stdout);
  const stderrBytes = Buffer.byteLength(agentResult.stderr);
  const totalBytes = promptBytes + stdoutBytes + stderrBytes;
  const platformWarningBytes = countMatchingLineBytes(agentResult.stderr, (line) => line.includes(" WARN codex_"));
  const skillReferenceOutputBytes = estimateSkillReferenceOutputBytes(agentResult.stderr, skillName);
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

function measurementBreakdown(trace, prompt, agentResult, skillDir, skillName) {
  return {
    schema_version: 1,
    timing: timingBreakdown(trace, agentResult),
    transcript: transcriptBreakdown(prompt, agentResult, skillDir, skillName),
    commands: commandBreakdown(trace),
  };
}

function traceMetrics(trace, prompt, agentResult) {
  const visible = trace.filter((entry) => !entry.internal);
  const shellCommands = visible.filter((entry) => isShellParent(entry.parent));
  const allVc = visible.filter(isVcEntry);
  const shellVc = shellCommands.filter(isVcEntry);
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
if (args.get("self-test-metrics") === "true") {
  runMetricsSelfTest();
  process.exit(0);
}

const taskId = args.get("task") ?? "pilot-1-selective-validation";
const agent = args.get("agent") ?? "codex";
const arm = args.get("arm") ?? "git";
const model = args.get("model") ?? (agent === "codex" ? DEFAULT_CODEX_MODEL : DEFAULT_CLAUDE_MODEL);
if (agent === "claude" && !/\d/.test(model)) {
  console.warn(`Warning: Claude model "${model}" is a floating alias, not a versioned model ID; the run will not be reproducible across model updates.`);
}
const timeoutMs = Number(args.get("timeout-ms") ?? 900000);
const realBut = executablePath(args.get("but-bin"), "but");
const realJj = executablePath(args.get("jj-bin"), "jj");
const skillDir = path.resolve(args.get("skill-dir") ?? "/Users/kiril/src/gitbutler/crates/but/skill");
const configuredJjSkillDir = args.get("jj-skill-dir") ? path.resolve(args.get("jj-skill-dir")) : null;
const jjSkillUrlArg = args.get("jj-skill-url") ?? null;
const jjSkillSha256Arg = args.get("jj-skill-sha256") ?? null;
const jjSkillSource = {
  package: args.get("jj-skill-package") ?? DEFAULT_JJ_SKILL.package,
  name: args.get("jj-skill-name") ?? DEFAULT_JJ_SKILL.name,
  source_rev: jjSkillUrlArg ? null : DEFAULT_JJ_SKILL.source_rev,
  source_url: jjSkillUrlArg ?? DEFAULT_JJ_SKILL.source_url,
  // A custom URL disables the default integrity pin unless a hash is given;
  // pass --jj-skill-sha256 none to skip the check explicitly.
  expected_sha256:
    jjSkillSha256Arg === "none"
      ? null
      : jjSkillSha256Arg ?? (jjSkillUrlArg ? null : DEFAULT_JJ_SKILL.expected_sha256),
  selection_note: args.get("jj-skill-selection-note") ?? DEFAULT_JJ_SKILL.selection_note,
};
const codexCleanConfig = agent === "codex" ? args.get("codex-clean-config") !== "false" : false;
const codexIsolatedHome = agent === "codex" && codexCleanConfig && args.get("codex-isolated-home") !== "false";
const codexDisablePlugins = agent === "codex" && codexCleanConfig && args.get("codex-disable-plugins") !== "false";
const claudeCleanConfig = agent === "claude" ? args.get("claude-clean-config") !== "false" : false;
const claudeEffortLevel = agent === "claude" && claudeCleanConfig ? (args.get("claude-effort-level") ?? "medium") : null;
const runId = args.get("run-id") ?? `${Date.now()}-${agent}-${arm.replaceAll("+", "-")}`;
const runDir = path.resolve(args.get("out") ?? path.join("tmp/pilot-runs", runId));

taskConfig = TASK_CONFIGS[taskId];
if (!taskConfig) {
  console.error(`Unknown task: ${taskId}`);
  console.error(`Known tasks: ${Object.keys(TASK_CONFIGS).join(", ")}`);
  process.exit(2);
}
taskDir = path.join(repoRoot, taskConfig.taskDir);

if (!["git", "but+skill", "jj+skill"].includes(arm)) {
  console.error("Usage: node scripts/run-pilot-agent.mjs --task <task-id> --agent <codex|claude> --arm <git|but+skill|jj+skill>");
  process.exit(2);
}

rmSync(runDir, { recursive: true, force: true });
mkdirSync(runDir, { recursive: true });

const butAppDataDir = arm === "but+skill" ? path.join(runDir, "but-app-data") : null;
const butEnv = butAppDataDir
  ? { ...process.env, E2E_TEST_APP_DATA_DIR: butAppDataDir }
  : process.env;
if (butAppDataDir) {
  mkdirSync(butAppDataDir, { recursive: true });
}
const resolvedJjSkill = arm === "jj+skill" ? resolveJjSkillSource(runDir, configuredJjSkillDir, jjSkillSource) : null;
const { workspace, setup } = prepareWorkspace(runDir, arm, realBut, skillDir, realJj, resolvedJjSkill, butEnv);
const { binDir, tracePath } = createWrappers(runDir, arm, realBut, realJj);
const codexHome = prepareCodexHome(runDir, codexIsolatedHome);
const claudeSettings = prepareClaudeSettings(runDir, claudeCleanConfig, claudeEffortLevel);
const claudeConfig = prepareClaudeConfig(claudeCleanConfig);
const prompt = buildPrompt();
writeFileSync(path.join(runDir, "prompt.txt"), prompt);

const env = {
  ...process.env,
  PATH: `${binDir}:${process.env.PATH}`,
  VCB_TRACE: tracePath,
  VCB_CODEX_CLEAN_CONFIG: String(codexCleanConfig),
  VCB_CODEX_DISABLE_PLUGINS: String(codexDisablePlugins),
  VCB_CLAUDE_CLEAN_CONFIG: String(claudeCleanConfig),
  JJ_EDITOR: "false",
};
if (codexHome) {
  env.CODEX_HOME = codexHome.path;
}
if (claudeSettings) {
  env.VCB_CLAUDE_SETTINGS = claudeSettings.path;
}
if (claudeConfig) {
  env.CLAUDE_CONFIG_DIR = claudeConfig.path;
  env.CLAUDE_CODE_OAUTH_TOKEN = claudeConfig.oauth_token;
  delete env.CLAUDE_SECURESTORAGE_CONFIG_DIR;
}
if (butAppDataDir) {
  env.E2E_TEST_APP_DATA_DIR = butAppDataDir;
}

let agentResult;
if (claudeConfig) process.once("exit", claudeConfig.cleanup);
try {
  agentResult = runAgent(agent, workspace, prompt, env, model, timeoutMs);
} finally {
  if (claudeConfig) {
    claudeConfig.cleanup();
    process.off("exit", claudeConfig.cleanup);
  }
}
writeFileSync(path.join(runDir, "agent-stdout.txt"), agentResult.stdout);
writeFileSync(path.join(runDir, "agent-stderr.txt"), agentResult.stderr);
const agentOutput = parseAgentOutput(agent, agentResult);
if (agentOutput.output_format === "json" && !agentOutput.parse_error) {
  writeFileSync(path.join(runDir, "agent-output.json"), agentResult.stdout);
}
const observedModel = agentOutput.observed_model;
const transcriptAgentResult = agentResultForTranscript(agentResult, agentOutput);

const verifierResult = verify(workspace);
const trace = markImplicitToolInternal(parseTrace(tracePath));
const metrics = traceMetrics(trace, prompt, transcriptAgentResult);
const activeSkillDir = arm === "but+skill" ? skillDir : arm === "jj+skill" ? resolvedJjSkill.dir : null;
const activeSkillName = arm.endsWith("+skill") ? setup.name : null;
const activeSkillInstallName = arm.endsWith("+skill") ? (setup.install_name ?? activeSkillName) : null;
const measurement = measurementBreakdown(trace, prompt, transcriptAgentResult, activeSkillDir, activeSkillInstallName);
const skillFile = path.join(activeSkillDir ?? skillDir, "SKILL.md");
const installedCodexSkill = activeSkillInstallName
  ? path.join(workspace, `.codex/skills/${activeSkillInstallName}/SKILL.md`)
  : null;
const installedClaudeSkill = activeSkillInstallName
  ? path.join(workspace, `.claude/skills/${activeSkillInstallName}/SKILL.md`)
  : null;
const butBinaryMetadata = arm === "but+skill"
  ? {
      path: realBut,
      sha256: sha256File(realBut),
      source_git: gitSourceInfo(realBut, { scope: "repo" }),
    }
  : null;
const jjBinaryMetadata = arm === "jj+skill"
  ? {
      path: realJj,
      sha256: sha256File(realJj),
      source_git: gitSourceInfo(realJj, { scope: "repo" }),
      version: run(realJj, ["--version"], { cwd: workspace }).stdout.trimEnd(),
    }
  : null;
const toolBinaryMetadata = arm === "but+skill" ? butBinaryMetadata : arm === "jj+skill" ? jjBinaryMetadata : null;
const skillSourceGit = activeSkillDir
  ? (arm === "jj+skill" && !setup.source?.configured_dir ? null : gitSourceInfo(activeSkillDir))
  : null;
const skillMetadata = activeSkillDir
  ? {
      name: activeSkillName,
      source_dir: activeSkillDir,
      source_package: setup.source?.package ?? null,
      source_url: setup.source?.source_url ?? null,
      source_rev: setup.source?.source_rev ?? null,
      source_expected_sha256: setup.source?.expected_sha256 ?? null,
      source_selection_note: setup.source?.selection_note ?? null,
      source_fetched_at: setup.source?.fetched_at ?? null,
      configured_dir: setup.source?.configured_dir ?? null,
      version: parseSkillVersion(skillFile),
      installed_version: setup.version ?? parseSkillVersion(skillFile),
      skill_file_sha256: sha256File(skillFile),
      source_dir_sha256: sha256Directory(activeSkillDir),
      installed_skill_file_sha256: installedCodexSkill && existsSync(installedCodexSkill)
        ? sha256File(installedCodexSkill)
        : null,
      installed_dir_sha256: installedCodexSkill && existsSync(installedCodexSkill)
        ? sha256Directory(path.dirname(installedCodexSkill))
        : null,
      source_git: skillSourceGit,
      installed_codex: installedCodexSkill,
      installed_claude: installedClaudeSkill,
    }
  : null;
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
  agent_cli_version: agentCliVersion(agent),
  agent_config: {
    codex_clean_config: agent === "codex" ? codexCleanConfig : null,
    codex_ephemeral: agent === "codex" ? codexCleanConfig : null,
    codex_ignore_user_config: agent === "codex" ? codexCleanConfig : null,
    codex_ignore_rules: agent === "codex" ? codexCleanConfig : null,
    codex_isolated_home: agent === "codex" ? codexIsolatedHome : null,
    codex_disable_plugins: agent === "codex" ? codexDisablePlugins : null,
    codex_home: codexHome?.path ?? null,
    codex_auth_copied: codexHome?.auth_copied ?? null,
    claude_clean_config: agent === "claude" ? claudeCleanConfig : null,
    claude_settings: claudeSettings?.path ?? null,
    claude_enabled_plugins: claudeSettings?.settings.enabledPlugins ?? null,
    claude_effort_level: claudeSettings?.settings.effortLevel ?? null,
    claude_strict_mcp_config: agent === "claude" ? claudeCleanConfig : null,
    claude_setting_sources: agent === "claude" && claudeCleanConfig ? ["project", "local"] : null,
    claude_config_dir: claudeConfig?.path ?? null,
    claude_auth_source: claudeConfig?.auth_source ?? null,
  },
  workspace,
  task: taskConfig.id,
  pre_run_setup: {
    fixture_created_clean: arm !== "git",
    gitbutler_setup_before_agent: arm === "but+skill",
    gitbutler_branch_applied_before_agent: arm === "but+skill" && taskConfig.gitbutlerPrep === "setup-and-apply-branch"
      ? taskConfig.applyBranch
      : null,
    jj_setup_before_agent: arm === "jj+skill",
    jj_colocated_before_agent: arm === "jj+skill",
    skill_installed_before_agent: arm.endsWith("+skill"),
    agent_instructions_before_agent: true,
    but_app_data_dir: butAppDataDir,
    dirty_state_applied_before_agent: taskConfig.applyDirtyState !== false || taskConfig.fixtureDirty !== false,
    included_in_agent_duration_or_metrics: false,
  },
  agent_instructions: setup.instructions,
  tool_binary: toolBinaryMetadata,
  but_binary: butBinaryMetadata,
  jj_binary: jjBinaryMetadata,
  skill: skillMetadata,
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
  agent_output: agentOutput,
  verifier: verifierResult,
  run_failure_class: runFailureClass,
  metrics,
  measurement,
};

writeFileSync(path.join(runDir, "result.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exit(agentResult.status === 0 && verifierResult.passed ? 0 : 1);
