#!/usr/bin/env node
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { parseArgs } from "./lib/args.mjs";
import { run } from "./lib/process.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const DEFAULT_CODEX_MODEL = "gpt-5.5";
const DEFAULT_POOL_MODEL = "poolside/laguna-s-2.1";
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

function minimalPoolEnvironment(source = process.env) {
  const allowed = [
    "PATH",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "TERM",
    "SHELL",
    "USER",
    "LOGNAME",
    "NO_COLOR",
    "SYSTEM_VERSION_COMPAT",
    "__CF_USER_TEXT_ENCODING",
  ];
  return Object.fromEntries(allowed.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
}

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

async function startPoolAuthProxy(runDir, sourceCredentialsPath) {
  const sourceStat = lstatSync(sourceCredentialsPath);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
    throw new Error(`Refusing non-regular Pool credential source: ${sourceCredentialsPath}`);
  }
  const credentials = JSON.parse(readFileSync(sourceCredentialsPath, "utf8"));
  const credential = Array.isArray(credentials)
    ? credentials.find((entry) => typeof entry?.apiUrl === "string" && typeof entry?.token === "string")
    : null;
  if (!credential || credential.token.length < 20) {
    throw new Error(`Could not find standalone Pool credentials in ${sourceCredentialsPath}`);
  }
  const upstream = new URL(credential.apiUrl);
  if (!["http:", "https:"].includes(upstream.protocol)) {
    throw new Error(`Unsupported Pool API protocol: ${upstream.protocol}`);
  }

  const portFile = path.join(runDir, "pool-auth-proxy.json");
  const logFile = path.join(runDir, "pool-auth-proxy.log");
  const child = spawn(process.execPath, [
    path.join(__dirname, "lib/pool-auth-proxy.mjs"),
    "--api-url", upstream.toString(),
    "--port-file", portFile,
    "--log-file", logFile,
    "--parent-pid", String(process.pid),
  ], {
    cwd: runDir,
    env: minimalPoolEnvironment(),
    stdio: ["pipe", "ignore", "ignore"],
  });
  child.stdin.on("error", () => {});
  child.stdin.end(credential.token);

  await new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      if (existsSync(portFile) || child.exitCode !== null || attempts >= 100) {
        resolve();
        return;
      }
      attempts += 1;
      setTimeout(check, 50);
    };
    check();
  });
  if (!existsSync(portFile)) {
    if (child.pid) process.kill(child.pid, "SIGTERM");
    throw new Error("Timed out starting the Pool authentication proxy");
  }
  const { port } = JSON.parse(readFileSync(portFile, "utf8"));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    if (child.pid) process.kill(child.pid, "SIGTERM");
    throw new Error("Pool authentication proxy returned an invalid port");
  }
  const upstreamBasePath = upstream.pathname.replace(/\/$/, "");
  const apiUrl = `http://127.0.0.1:${port}${upstreamBasePath}`;
  let stopPromise = null;
  return {
    api_url: apiUrl,
    source_credentials_path: sourceCredentialsPath,
    log_path: logFile,
    upstream_origin: upstream.origin,
    upstream_base_path: upstreamBasePath,
    sanitized_credentials: [{
      type: credential.type,
      apiUrl,
      token: "POOL_AUTH_PROXY_DUMMY_TOKEN_NOT_A_SECRET",
      serviceMode: credential.serviceMode,
    }],
    stop: () => {
      if (stopPromise) return stopPromise;
      stopPromise = new Promise((resolve) => {
        if (child.exitCode !== null) {
          resolve();
          return;
        }
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          resolve();
        };
        child.once("exit", finish);
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode === null) child.kill("SIGKILL");
          setTimeout(finish, 250).unref();
        }, 1000).unref();
      });
      return stopPromise;
    },
  };
}

function unlinkIsolatedPoolCredential(poolHome, credentialsPath) {
  const resolvedHome = path.resolve(poolHome);
  const expectedPath = path.join(resolvedHome, ".config/poolside/credentials.json");
  if (path.resolve(credentialsPath) !== expectedPath) {
    throw new Error(`Refusing unexpected Pool credential path: ${credentialsPath}`);
  }
  const components = [resolvedHome, path.join(resolvedHome, ".config"), path.join(resolvedHome, ".config/poolside")];
  for (const component of components) {
    const stat = lstatSync(component);
    if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(component) !== component) {
      throw new Error(`Refusing Pool credential cleanup through unsafe directory: ${component}`);
    }
  }
  if (!existsSync(expectedPath)) return;
  const credentialStat = lstatSync(expectedPath);
  if (!credentialStat.isFile() || credentialStat.isSymbolicLink()) {
    throw new Error(`Refusing to unlink non-regular Pool credential: ${expectedPath}`);
  }
  unlinkSync(expectedPath);
}

async function preparePoolHome(runDir, enabled, requestedModel) {
  if (!enabled) return null;

  const sourceHome = path.resolve(process.env.HOME ?? homedir());
  const poolHome = path.join(runDir, "pool-home");
  const sourceConfigDir = path.join(sourceHome, ".config/poolside");
  const sourceCredentialsPath = path.join(sourceConfigDir, "credentials.json");
  const configDir = path.join(poolHome, ".config/poolside");
  mkdirSync(configDir, { recursive: true, mode: 0o700 });
  chmodSync(configDir, 0o700);
  mkdirSync(path.join(configDir, "skills"), { recursive: true, mode: 0o700 });

  const authProxy = await startPoolAuthProxy(runDir, sourceCredentialsPath);
  const settingsPath = path.join(configDir, "settings.yaml");
  writeFileSync(settingsPath, `pool:
    api_url: ${JSON.stringify(authProxy.api_url)}
agent_servers:
    Poolside:
        type: custom
        command: pool
        args:
            - acp
        default_config_options:
            model: ${JSON.stringify(requestedModel)}
`, { mode: 0o600 });
  const credentialsPath = path.join(configDir, "credentials.json");
  writeFileSync(credentialsPath, JSON.stringify(authProxy.sanitized_credentials), { mode: 0o600 });
  const runtimeWriteDirs = [
    path.join(configDir, "skills"),
    path.join(poolHome, ".config/jj"),
    path.join(poolHome, "Library/Application Support/poolside"),
    path.join(poolHome, "Library/Caches/poolside"),
    path.join(poolHome, ".cache/poolside"),
  ];
  for (const directory of runtimeWriteDirs) mkdirSync(directory, { recursive: true, mode: 0o700 });

  return {
    path: poolHome,
    source_home: sourceHome,
    credentials_copied: false,
    credentials_sanitized: true,
    settings_copied: false,
    settings_sanitized: true,
    configured_model: requestedModel,
    auth_proxy: authProxy,
    runtime_write_dirs: runtimeWriteDirs,
    credentials_path: credentialsPath,
    cleanup_credentials: () => {
      unlinkIsolatedPoolCredential(poolHome, credentialsPath);
    },
  };
}

function installPoolHostSandbox(runDir, enabled, writePaths, readDeniedPaths = []) {
  if (!enabled) return null;

  const executable = executablePath(null, "sandbox-exec");
  const profilePath = path.join(runDir, "pool-host-sandbox.sb");
  const allowedWrites = writePaths.filter(Boolean);
  const writeRules = allowedWrites
    .map(({ kind, target }) => `(allow file-write* (${kind} ${JSON.stringify(target)}))`)
    .join("\n");
  const deniedReads = [profilePath, ...readDeniedPaths.filter(Boolean)];
  const readRules = deniedReads
    .map((target) => `(deny file-read* (literal ${JSON.stringify(target)}))`)
    .join("\n");
  writeFileSync(profilePath, `(version 1)
(allow default)
${readRules}
(deny file-write*)
${writeRules}
(allow file-write* (literal "/dev/null"))
`);
  return {
    executable,
    profile_path: profilePath,
    write_roots: allowedWrites.filter((entry) => entry.kind === "subpath").map((entry) => entry.target),
    write_files: allowedWrites.filter((entry) => entry.kind === "literal").map((entry) => entry.target),
    read_denied_files: deniedReads,
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
export PATH="$(dirname "$0"):$PATH"
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
          -a|--all|--list|--show-current) BRANCH_READ=true ;;
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

function renderGitButlerInstructions(workspace, realBut, codexSkillPath, claudeSkillPath, poolSkillPath, butEnv) {
  const setupBlock = run(realBut, ["agent", "setup", "--print"], { cwd: workspace, env: butEnv }).stdout.trimEnd();
  const content = `# AGENTS.md

## Benchmark boundary

Work only in the current repository. Do not inspect parent benchmark directories, hidden oracle files, or solution scripts.

## Local skill

The official GitButler CLI skill is installed for this benchmark trial at:

- ${codexSkillPath}
- ${claudeSkillPath}${poolSkillPath ? `\n- ${poolSkillPath}` : ""}

Use the installed skill if your agent runtime loads local skills or you need GitButler command details.

${setupBlock}
`;

  return {
    content,
    setup_block: setupBlock,
    setup_block_sha256: sha256Text(setupBlock),
  };
}

function renderJjInstructions(workspace, realJj, codexSkillPath, claudeSkillPath, poolSkillPath, sourceMetadata) {
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
- ${claudeSkillPath}${poolSkillPath ? `\n- ${poolSkillPath}` : ""}

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

function appendHarnessExclude(workspace, includePoolSkill = false) {
  writeFileSync(
    path.join(workspace, ".git/info/exclude"),
    `\n# version-control-bench harness files\n.codex/\n.claude/\n${includePoolSkill ? ".agents/\n" : ""}AGENTS.md\nCLAUDE.md\n`,
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

function installPoolToolPolicy(workspace, binDir) {
  const settingsDir = path.join(workspace, ".poolside");
  const settingsPath = path.join(settingsDir, "settings.local.yaml");
  mkdirSync(settingsDir, { recursive: true });
  writeFileSync(settingsPath, `tools:
  shell:
    deny:
      - "git"
      - "git *"
      - "but"
      - "but *"
      - "jj"
      - "jj *"
      - "*&& git *"
      - "*&& but *"
      - "*&& jj *"
      - "*; git *"
      - "*; but *"
      - "*; jj *"
      - "*| git *"
      - "*| but *"
      - "*| jj *"
      - "* /tmp/*"
      - "*>/tmp/*"
      - "*=/tmp/*"
      - "/tmp/*"
      - "* /private/tmp/*"
      - "*>/private/tmp/*"
      - "*=/private/tmp/*"
      - "/private/tmp/*"
paths:
  allow:
    - path: ${JSON.stringify(`${workspace}/**`)}
      write: true
  deny:
    - path: "/tmp/**"
    - path: "/private/tmp/**"
`);
  writeFileSync(path.join(workspace, ".git/info/exclude"), ".poolside/\n", { flag: "a" });

  return {
    settings_path: settingsPath,
    git_wrapper: path.join(binDir, "git"),
    but_wrapper: path.join(binDir, "but"),
    jj_wrapper: path.join(binDir, "jj"),
  };
}

function installGitButlerSkill(workspace, skillDir, realBut, butEnv, installPoolSkill = false) {
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

  const installRoots = [".codex/skills/gitbutler", ".claude/skills/gitbutler"];
  if (installPoolSkill) installRoots.push(".agents/skills/gitbutler");
  for (const root of installRoots) {
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
  const poolSkillPath = installPoolSkill ? path.join(workspace, ".agents/skills/gitbutler/SKILL.md") : null;
  const instructions = renderGitButlerInstructions(workspace, realBut, codexSkillPath, claudeSkillPath, poolSkillPath, butEnv);
  writeAgentInstructionFiles(workspace, instructions.content);

  appendHarnessExclude(workspace, installPoolSkill);

  return {
    name: parseSkillName(skillFile) ?? "but",
    install_name: "gitbutler",
    source_dir: skillDir,
    version: cliVersion,
    installed,
    instructions: {
      installed_codex: path.join(workspace, "AGENTS.md"),
      installed_claude: path.join(workspace, "CLAUDE.md"),
      ...(installPoolSkill ? { installed_pool: path.join(workspace, "AGENTS.md") } : {}),
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

function installJjSkill(workspace, skillDir, realJj, sourceMetadata, installPoolSkill = false) {
  const skillFile = path.join(skillDir, "SKILL.md");
  if (!existsSync(skillFile)) {
    throw new Error(`Jujutsu skill file not found: ${skillFile}`);
  }

  const refsDir = path.join(skillDir, "references");
  const installed = [];
  const skillName = parseSkillName(skillFile) ?? sourceMetadata.name ?? path.basename(skillDir);

  const installRoots = [`.codex/skills/${skillName}`, `.claude/skills/${skillName}`];
  if (installPoolSkill) installRoots.push(`.agents/skills/${skillName}`);
  for (const root of installRoots) {
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
  const poolSkillPath = installPoolSkill ? path.join(workspace, `.agents/skills/${skillName}/SKILL.md`) : null;
  const instructions = renderJjInstructions(workspace, realJj, codexSkillPath, claudeSkillPath, poolSkillPath, sourceMetadata);
  writeAgentInstructionFiles(workspace, instructions.content);

  appendHarnessExclude(workspace, installPoolSkill);

  return {
    name: skillName,
    source_dir: skillDir,
    source: sourceMetadata,
    version: parseSkillVersion(skillFile),
    installed,
    instructions: {
      installed_codex: path.join(workspace, "AGENTS.md"),
      installed_claude: path.join(workspace, "CLAUDE.md"),
      ...(installPoolSkill ? { installed_pool: path.join(workspace, "AGENTS.md") } : {}),
      source_package: sourceMetadata.package ?? null,
      source_url: sourceMetadata.source_url ?? null,
      source_command: "jj --version",
      setup_block_sha256: instructions.setup_block_sha256,
      tool_version: instructions.version,
    },
  };
}

function prepareWorkspace(runDir, arm, agent, realBut, butSkillDir, realJj, jjSkill, butEnv) {
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
    const setup = installGitButlerSkill(workspace, butSkillDir, realBut, butEnv, agent === "pool");
    if (taskConfig.applyDirtyState !== false) {
      run("node", [path.join(repoRoot, taskConfig.applyStateScript), "dirty", workspace], { cwd: repoRoot });
    }
    return { workspace, setup };
  }

  if (arm === "jj+skill") {
    run(realJj, ["git", "init", "--colocate"], { cwd: workspace, stdio: "pipe" });
    run(realJj, ["config", "set", "--repo", "ui.paginate", "never"], { cwd: workspace, stdio: "pipe" });
    const setup = installJjSkill(workspace, jjSkill.dir, realJj, jjSkill.source, agent === "pool");
    if (taskConfig.applyDirtyState !== false) {
      run("node", [path.join(repoRoot, taskConfig.applyStateScript), "dirty", workspace], { cwd: repoRoot });
    }
    return { workspace, setup };
  }

  return { workspace, setup: { instructions: installPlainGitInstructions(workspace) } };
}

function buildPrompt(agent, poolToolPolicy, poolSkillName) {
  const instruction = readFileSync(path.join(taskDir, "instruction.md"), "utf8").trim();
  const poolSkill = agent === "pool" && poolSkillName
    ? [`Before any version-control work, load and follow the \`$${poolSkillName}\` skill installed for this trial.`, ""]
    : [];
  const poolPolicy = agent === "pool" && poolToolPolicy
    ? [
        "Harness requirement: invoke version-control CLIs only through these absolute executables:",
        `- Git: ${poolToolPolicy.git_wrapper}`,
        `- GitButler: ${poolToolPolicy.but_wrapper}`,
        `- Jujutsu: ${poolToolPolicy.jj_wrapper}`,
        "Do not invoke raw `git`, `but`, or `jj` command names; unwrapped invocations are blocked or invalidate the trial so the harness can enforce the selected arm and record measurements.",
        "Keep every temporary file inside the run-specific `$TMPDIR`; never create or modify files under system `/tmp` or `/private/tmp`.",
        "",
      ]
    : [];

  return [
    "You are running inside a version-control benchmark sandbox.",
    "All requested file changes already exist. Do not implement new code; only perform the requested version-control operation.",
    "Work only in the current repository. Do not inspect parent benchmark directories, hidden oracle files, or solution scripts.",
    "",
    ...poolSkill,
    ...poolPolicy,
    `Task: ${instruction}`,
    "",
    "When the repository state is correct, stop.",
  ].join("\n");
}

function agentCliVersion(agent, configuredExecutable = null) {
  const cmd = configuredExecutable ?? {
    codex: "codex",
    claude: "claude",
    pool: "pool",
  }[agent];
  if (!cmd) return null;
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
  } else if (agent === "pool") {
    const poolArgs = [
      "exec",
      "--unsafe-auto-allow",
      "--sandbox", "disabled",
      "-d", workspace,
      "-o", "json",
      "--verbose",
      "-p", prompt,
    ];
    if (env.VCB_POOL_HOST_SANDBOX_PROFILE) {
      cmd = env.VCB_POOL_HOST_SANDBOX_EXECUTABLE;
      args = ["-f", env.VCB_POOL_HOST_SANDBOX_PROFILE, env.VCB_POOL_EXECUTABLE, ...poolArgs];
    } else {
      cmd = env.VCB_POOL_EXECUTABLE ?? "pool";
      args = poolArgs;
    }
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

function parseNdjson(text) {
  const entries = [];
  const errors = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const parsed = parseJsonObject(line);
    if (parsed) {
      entries.push(parsed);
    } else {
      errors.push(`line ${index + 1} is not a JSON object`);
    }
  }
  return { entries, errors };
}

function poolTrajectoryDirectory(env, poolExecutable = "pool") {
  const config = run(poolExecutable, ["config"], { env, check: false });
  if (config.status !== 0) {
    throw new Error(`pool config failed (${config.status}): ${config.stderr.trim()}`);
  }
  const directory = /^trajectory directory:\s*(.+)$/m.exec(config.stdout)?.[1]?.trim();
  if (!directory) {
    throw new Error(`Could not parse Pool trajectory directory from: ${JSON.stringify(config.stdout)}`);
  }
  return path.resolve(directory);
}

function locatePoolTrajectory(workspace, agentResult, runDir, env, poolExecutable = "pool") {
  const trajectoryDir = poolTrajectoryDirectory(env, poolExecutable);
  if (!existsSync(trajectoryDir)) {
    throw new Error(`Pool trajectory directory not found: ${trajectoryDir}`);
  }

  const normalizedWorkspace = path.resolve(workspace);
  const toleranceMs = 5000;
  const matches = [];
  for (const name of readdirSync(trajectoryDir).filter((entry) => entry.endsWith(".ndjson"))) {
    const sourcePath = path.join(trajectoryDir, name);
    const text = readFileSync(sourcePath, "utf8");
    const parsed = parseNdjson(text);
    if (parsed.errors.length > 0) continue;
    const start = parsed.entries.find((entry) => entry.type === "session.start");
    const workingDirectories = start?.session_start?.working_directories;
    const timestampMs = Date.parse(start?.timestamp ?? "");
    const workspaceMatches = Array.isArray(workingDirectories)
      && workingDirectories.some((directory) => path.resolve(directory) === normalizedWorkspace);
    const timeMatches = Number.isFinite(timestampMs)
      && timestampMs >= agentResult.start_ms - toleranceMs
      && timestampMs <= agentResult.end_ms + toleranceMs;
    if (workspaceMatches && timeMatches) {
      matches.push({ sourcePath, text, entries: parsed.entries, timestampMs });
    }
  }

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one Pool trajectory for ${workspace} during the agent run; found ${matches.length}`,
    );
  }

  const match = matches[0];
  const installedPath = path.join(runDir, "pool-trajectory.ndjson");
  cpSync(match.sourcePath, installedPath);
  return {
    source_path: match.sourcePath,
    installed_path: installedPath,
    entries: match.entries,
  };
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

function splitShellClauses(command) {
  const clauses = [];
  let text = "";
  let quote = null;
  let escaped = false;
  let precedingOperator = null;
  const push = (nextOperator) => {
    if (text.trim()) clauses.push({ text: text.trim().replace(/^[({]\s*/, ""), preceding_operator: precedingOperator });
    text = "";
    precedingOperator = nextOperator;
  };

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (escaped) {
      text += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      text += char;
      escaped = true;
      continue;
    }
    if (quote) {
      text += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      text += char;
      continue;
    }
    const pair = command.slice(index, index + 2);
    if (pair === "&&" || pair === "||") {
      push(pair);
      index += 1;
      continue;
    }
    if (char === ";" || char === "|" || char === "\n") {
      push(char);
      continue;
    }
    text += char;
  }
  push(null);
  return clauses;
}

function shellTokens(clause) {
  const tokens = [];
  let token = "";
  let quote = null;
  let escaped = false;
  let started = false;
  const push = () => {
    if (started) tokens.push(token);
    token = "";
    started = false;
  };

  for (const char of clause) {
    if (escaped) {
      token += char;
      started = true;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      started = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else token += char;
      started = true;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      started = true;
      continue;
    }
    if (/\s/.test(char)) {
      push();
      continue;
    }
    token += char;
    started = true;
  }
  if (escaped) token += "\\";
  push();
  return tokens;
}

function shellAssignment(token) {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(token);
  return match ? { name: match[1], value: match[2] } : null;
}

function shellRedirection(token) {
  const match = /^(?:(?:\d+)?(?:>>?|<<<?|<>|>&|<&)|&>>?)(.*)$/.exec(token ?? "");
  return match ? { hasTarget: match[1].length > 0 } : null;
}

function expandShellExecutable(token, variables) {
  const match = /^\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))$/.exec(token ?? "");
  return match ? (variables.get(match[1] ?? match[2]) ?? token) : token;
}

function vcInvocation(executable, args, clause, precedingOperator, wrapperPaths) {
  const tool = executable ? path.basename(executable) : null;
  if (!["git", "but", "jj"].includes(tool)) return null;
  const expectedWrapper = wrapperPaths?.[tool] ? path.resolve(wrapperPaths[tool]) : null;
  const normalizedExecutable = path.isAbsolute(executable) ? path.resolve(executable) : executable;
  return {
    tool,
    executable,
    kind: expectedWrapper && normalizedExecutable === expectedWrapper ? "wrapper" : "raw",
    argv: args.join(" "),
    command: clause,
    preceding_operator: precedingOperator,
  };
}

function shellVcInvocations(command, wrapperPaths = {}, initialVariables = new Map()) {
  if (typeof command !== "string") return [];
  const invocations = [];
  const variables = new Map(initialVariables);

  for (const clause of splitShellClauses(command)) {
    const tokens = shellTokens(clause.text);
    let index = 0;
    const consumePrefixes = () => {
      let consumed = true;
      while (consumed && index < tokens.length) {
        consumed = false;
        if (["do", "then", "else", "if", "while", "until", "!"].includes(tokens[index])) {
          index += 1;
          consumed = true;
          continue;
        }
        const assignment = shellAssignment(tokens[index]);
        if (assignment) {
          variables.set(assignment.name, assignment.value);
          index += 1;
          consumed = true;
          continue;
        }
        const redirection = shellRedirection(tokens[index]);
        if (redirection) {
          index += redirection.hasTarget ? 1 : 2;
          consumed = true;
        }
      }
    };
    consumePrefixes();
    if (index >= tokens.length) continue;

    let launcher = path.basename(tokens[index]);
    while (["command", "exec", "nohup", "sudo", "time", "env"].includes(launcher)) {
      if (launcher === "command" && ["-v", "-V"].includes(tokens[index + 1])) {
        index = tokens.length;
        break;
      }
      const activeLauncher = launcher;
      index += 1;
      while (index < tokens.length && tokens[index].startsWith("-")) {
        const option = tokens[index];
        index += 1;
        const takesValue = (activeLauncher === "env" && ["-u", "--unset", "-C", "--chdir"].includes(option))
          || (activeLauncher === "sudo" && ["-u", "--user", "-g", "--group", "-h", "--host", "-p", "--prompt", "-C", "--chdir"].includes(option))
          || (activeLauncher === "time" && ["-f", "--format", "-o", "--output"].includes(option));
        if (takesValue) index += 1;
      }
      while (index < tokens.length) {
        const assignment = shellAssignment(tokens[index]);
        if (!assignment) break;
        variables.set(assignment.name, assignment.value);
        index += 1;
      }
      consumePrefixes();
      launcher = path.basename(tokens[index] ?? "");
    }
    if (index >= tokens.length) continue;

    const executable = expandShellExecutable(tokens[index], variables);
    const basename = path.basename(executable ?? "");
    const args = tokens.slice(index + 1);
    if (["sh", "bash", "zsh"].includes(basename)) {
      const commandIndex = args.findIndex((arg) => arg === "-c");
      if (commandIndex >= 0 && typeof args[commandIndex + 1] === "string") {
        invocations.push(...shellVcInvocations(args[commandIndex + 1], wrapperPaths, variables));
      }
      continue;
    }
    if (basename === "xargs") {
      const nestedIndex = args.findIndex((arg) => ["git", "but", "jj"].includes(path.basename(expandShellExecutable(arg, variables) ?? "")));
      if (nestedIndex >= 0) {
        const nestedExecutable = expandShellExecutable(args[nestedIndex], variables);
        const invocation = vcInvocation(nestedExecutable, args.slice(nestedIndex + 1), clause.text, clause.preceding_operator, wrapperPaths);
        if (invocation) invocations.push(invocation);
      }
      continue;
    }
    if (basename === "find") {
      const execIndex = args.findIndex((arg) => arg === "-exec" || arg === "-execdir");
      if (execIndex >= 0) {
        const nestedExecutable = expandShellExecutable(args[execIndex + 1], variables);
        const invocation = vcInvocation(nestedExecutable, args.slice(execIndex + 2), clause.text, clause.preceding_operator, wrapperPaths);
        if (invocation) invocations.push(invocation);
      }
      continue;
    }

    const invocation = vcInvocation(executable, args, clause.text, clause.preceding_operator, wrapperPaths);
    if (invocation) invocations.push(invocation);
  }
  return invocations;
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

function poolRateLimitError(agentResult, entries) {
  if (agentResult.status === 0 || agentResult.timed_out) return null;
  const statusKeys = new Set(["status", "statusCode", "status_code", "httpStatus"]);
  const hasStructured429 = (value) => {
    if (!value || typeof value !== "object") return false;
    return Object.entries(value).some(([key, nested]) =>
      (statusKeys.has(key) && Number(nested) === 429) || hasStructured429(nested));
  };
  if (entries.some((entry) => hasStructured429(entry))) {
    return { kind: "rate_limit", status_code: 429, detector_version: 1, source: "structured-error" };
  }
  const errorText = [
    agentResult.stderr,
    ...entries
      .filter((entry) => entry.type === "error" || entry.error || entry.err)
      .map((entry) => JSON.stringify(entry)),
  ].filter(Boolean).join("\n");
  const explicit429 = /(?:HTTP\s*429|status(?:_|\s)?code\s*[:=]?\s*429|429\s+Too Many Requests)/i.test(errorText);
  const rateLimited429 = /\b429\b/.test(errorText) && /(?:rate.?limit|too many requests)/i.test(errorText);
  return explicit429 || rateLimited429
    ? { kind: "rate_limit", status_code: 429, detector_version: 1, source: "error-channel" }
    : null;
}

function nestedStringValues(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(nestedStringValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(nestedStringValues);
  return [];
}

function indirectRawVcReferences(value) {
  const references = [];
  const pattern = /(?:^|[\s;|&!>(`"'])\s*(?:exec\s+)?(?:\/(?:[^\s/;|&()`"']+)\/)*(git|but|jj)\s+(?:add|am|apply|branch|checkout|cherry-pick|clean|commit|merge|mv|rebase|reset|restore|revert|rm|stash|switch|tag|update-index|update-ref|status|diff|show|log|rev-parse|for-each-ref|ls-files|squash|move|uncommit|amend|pull|push|new|split|describe|edit|abandon)\b/gim;
  for (const text of nestedStringValues(value)) {
    for (const match of text.matchAll(pattern)) references.push({ tool: match[1].toLowerCase(), sample: match[0].trim() });
  }
  return references;
}

function indirectExecutableRawVcReferences(value) {
  return indirectRawVcReferences(
    nestedStringValues(value)
      .map((text) => text.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n")),
  );
}

function parsePoolOutput(agentResult, trajectory, requestedModel, options = {}) {
  const parsedStdout = parseNdjson(agentResult.stdout);
  const transcriptEntries = parsedStdout.entries.filter(
    (entry) => ["assistantMessage", "toolCall", "toolCallResult"].includes(entry.type),
  );
  const transcriptStdout = transcriptEntries.length > 0
    ? `${transcriptEntries.map((entry) => JSON.stringify(entry)).join("\n")}\n`
    : "";
  const errors = parsedStdout.errors.map((error) => `Pool stdout ${error}`);
  let pendingToolCall = null;
  const policyDenials = [];
  const shellVcCalls = [];
  const shellEvents = [];
  const externalPathAttempts = [];
  const indirectRawVcCalls = [];
  const unsupportedShellVcCalls = [];
  let skillReferenceOutputBytes = 0;
  for (let eventIndex = 0; eventIndex < parsedStdout.entries.length; eventIndex += 1) {
    const entry = parsedStdout.entries[eventIndex];
    if (entry.type === "toolCall") {
      if (pendingToolCall) errors.push(`Pool emitted a tool call before the prior ${pendingToolCall.name ?? "unknown"} call returned`);
      const serializedArgs = JSON.stringify(entry.args ?? {});
      if (/(?:^|[\s"'=><;|&(])\/(?:private\/)?tmp\//.test(serializedArgs)) {
        externalPathAttempts.push({ tool: entry.name ?? null, args: entry.args ?? null });
      }
      if (entry.name !== "shell") indirectRawVcCalls.push(...indirectExecutableRawVcReferences(entry.args ?? {}));
      const shellEvent = entry.name === "shell" && typeof entry.args?.cmd === "string"
        ? {
            event_index: eventIndex,
            command: entry.args.cmd,
            result_seen: false,
            result_error: null,
            policy_denial: false,
            vc_invocations: shellVcInvocations(entry.args.cmd, options.wrapper_paths),
          }
        : null;
      if (shellEvent) {
        const command = entry.args.cmd;
        const invokesOpaqueLoader = /(?:^|[;&|]\s*)(?:eval|source|\.)\s+\S+/.test(command);
        const hasOpaqueSyntaxAroundVc = /(?:`|\$\(|[<>]\()/.test(command)
          && /\b(?:git|but|jj)\b/.test(command);
        const hasIndirectRawVcText = indirectExecutableRawVcReferences(command).length > 0;
        const writesUnparsedVcText = hasIndirectRawVcText
          && (/<</.test(command) || (/>/.test(command) && shellEvent.vc_invocations.length === 0));
        if (invokesOpaqueLoader || hasOpaqueSyntaxAroundVc || writesUnparsedVcText) {
          unsupportedShellVcCalls.push(command.trim());
        }
        shellEvents.push(shellEvent);
        shellVcCalls.push(...shellEvent.vc_invocations);
      }
      pendingToolCall = { name: entry.name ?? null, args: entry.args ?? {}, shell_event: shellEvent };
      continue;
    }
    if (entry.type === "toolCallResult") {
      if (!pendingToolCall) {
        errors.push("Pool emitted a tool result without a pending tool call");
        continue;
      }
      if (pendingToolCall.shell_event) {
        pendingToolCall.shell_event.result_seen = true;
        pendingToolCall.shell_event.result_error = typeof entry.err === "string" ? entry.err : null;
        const denyMatch = typeof entry.err === "string"
          ? entry.err.match(/matched shell deny setting:\s*(git|but|jj)(?:\s+\*|\b)/i)
          : null;
        if (denyMatch) {
          pendingToolCall.shell_event.policy_denial = true;
          const deniedInvocations = pendingToolCall.shell_event.vc_invocations.length > 0
            ? pendingToolCall.shell_event.vc_invocations
            : [{ tool: denyMatch[1].toLowerCase(), argv: "", command: pendingToolCall.shell_event.command }];
          for (const invocation of deniedInvocations) {
            policyDenials.push({
              bucket: "task",
              tool: invocation.tool,
              status: 42,
              argv: invocation.argv || invocation.command,
            });
          }
        }
      }
      if (
        pendingToolCall.name === "skill"
        && (!options.expected_skill_name || pendingToolCall.args?.name === options.expected_skill_name)
        && typeof entry.result === "string"
      ) {
        const serializedWithResult = JSON.stringify(entry);
        const serializedWithoutResult = JSON.stringify({ ...entry, result: "" });
        skillReferenceOutputBytes += Buffer.byteLength(serializedWithResult) - Buffer.byteLength(serializedWithoutResult);
      }
      pendingToolCall = null;
    }
  }
  if (pendingToolCall && (!agentResult.timed_out || pendingToolCall.name !== "shell")) {
    errors.push(`Pool transcript ended with an unresolved ${pendingToolCall.name ?? "unknown"} tool call`);
  }
  if (externalPathAttempts.length > 0) {
    errors.push(`Pool shell command referenced a system temp path outside the run sandbox (${externalPathAttempts.length} attempt(s))`);
  }
  if (indirectRawVcCalls.length > 0) {
    errors.push(`Pool tool content contained ${indirectRawVcCalls.length} indirect raw VC invocation(s)`);
  }
  if (unsupportedShellVcCalls.length > 0) {
    errors.push(`Pool shell command used unsupported syntax around VC invocation(s) (${unsupportedShellVcCalls.length} call(s))`);
  }
  if (transcriptEntries.length === 0) errors.push("Pool stdout contained no transcript events");
  if (trajectory.error) errors.push(`Pool trajectory: ${trajectory.error}`);

  const trajectoryEntries = trajectory.entries ?? [];
  const inferenceModels = trajectoryEntries
    .filter((entry) => entry.type === "tool_call.inference.start")
    .map((entry) => entry.tool_call_inference_start?.chat_completion_request?.model)
    .filter((value) => typeof value === "string" && value.length > 0);
  const observedModels = [...new Set(inferenceModels)];
  const observedModel = observedModels.length === 1 ? observedModels[0] : null;
  if (inferenceModels.length === 0) {
    errors.push("Pool trajectory contained no inference-start model");
  } else if (observedModels.length !== 1) {
    errors.push(`Pool trajectory used multiple models: ${observedModels.join(", ")}`);
  } else if (observedModel !== requestedModel) {
    errors.push(`Pool model mismatch: requested ${requestedModel}, observed ${observedModel}`);
  }

  const tokenKeys = [
    "input_tokens",
    "output_tokens",
    "cache_read_input_tokens",
    "cache_write_input_tokens",
  ];
  let inferenceEndCount = 0;
  let tokensUsedTotal = 0;
  for (const entry of trajectoryEntries.filter((candidate) => candidate.type === "tool_call.inference.end")) {
    inferenceEndCount += 1;
    const usage = entry.tool_call_inference_end ?? {};
    tokensUsedTotal += tokenKeys.reduce(
      (sum, key) => sum + (Number.isFinite(usage[key]) ? usage[key] : 0),
      0,
    );
  }

  return {
    output_format: "nljson",
    parse_error: errors.length > 0,
    output_error: errors.length > 0 ? errors.join("; ") : null,
    observed_model: observedModel,
    observed_model_source: "trajectory.inference.start",
    observed_models: observedModels,
    inference_start_count: inferenceModels.length,
    inference_end_count: inferenceEndCount,
    tokens_used_total: inferenceEndCount > 0 ? tokensUsedTotal : null,
    retryable_error: poolRateLimitError(agentResult, parsedStdout.entries),
    policy_denials: policyDenials,
    shell_vc_attempt_count: shellVcCalls.length,
    shell_vc_calls: shellVcCalls,
    shell_events: shellEvents,
    external_path_attempt_count: externalPathAttempts.length,
    external_path_attempts: externalPathAttempts,
    indirect_raw_vc_invocation_count: indirectRawVcCalls.length,
    indirect_raw_vc_invocations: indirectRawVcCalls,
    unsupported_shell_vc_call_count: unsupportedShellVcCalls.length,
    unsupported_shell_vc_calls: unsupportedShellVcCalls,
    pending_tool_call: pendingToolCall ? { name: pendingToolCall.name, args: pendingToolCall.args } : null,
    skill_reference_output_bytes: skillReferenceOutputBytes,
    transcript_stdout: transcriptStdout,
    trajectory_source_path: trajectory.source_path ?? null,
    trajectory_path: trajectory.installed_path ?? null,
  };
}

function applyUntracedPolicyDenials(metrics, measurement, denials) {
  if (!Array.isArray(denials) || denials.length === 0) return;

  metrics.total_logged_commands += denials.length;
  metrics.shell_logged_commands += denials.length;
  metrics.shell_vc_command_count += denials.length;
  metrics.vc_command_count += denials.length;
  metrics.task_vc_command_count += denials.length;
  metrics.failed_vc_commands += denials.length;
  metrics.task_failed_vc_commands += denials.length;
  metrics.untraced_policy_denial_count = denials.length;
  measurement.commands.total_logged_commands += denials.length;

  for (const bucketName of ["visible", "task"]) {
    const bucket = measurement.commands[bucketName];
    bucket.command_count += denials.length;
    bucket.vc_command_count += denials.length;
    bucket.failed_vc_command_count += denials.length;
    bucket.policy_block_count += denials.length;
    for (const denial of denials) {
      bucket[`${denial.tool}_command_count`] += 1;
      const syntheticEntry = { tool: denial.tool, argv: denial.argv, status: denial.status };
      if (isInspection(syntheticEntry)) bucket.inspection_count += 1;
      if (isMutation(syntheticEntry)) bucket.mutation_count += 1;
    }
    bucket.read_to_write_ratio = bucket.mutation_count > 0 ? bucket.inspection_count / bucket.mutation_count : null;
  }
  for (const denial of denials) {
    const syntheticEntry = { tool: denial.tool, argv: denial.argv, status: denial.status };
    if (isInspection(syntheticEntry)) {
      metrics.vc_inspection_count += 1;
      metrics.task_vc_inspection_count += 1;
    }
    if (isMutation(syntheticEntry)) {
      metrics.vc_mutation_count += 1;
      metrics.task_vc_mutation_count += 1;
    }
  }
  metrics.read_to_write_ratio = metrics.vc_mutation_count > 0
    ? metrics.vc_inspection_count / metrics.vc_mutation_count
    : null;
  metrics.task_read_to_write_ratio = metrics.task_vc_mutation_count > 0
    ? metrics.task_vc_inspection_count / metrics.task_vc_mutation_count
    : null;
  measurement.commands.untraced_policy_denial_count = denials.length;
  measurement.commands.synthetic_policy_denial_count = denials.length;
  measurement.commands.failed_command_samples = [
    ...measurement.commands.failed_command_samples,
    ...denials,
  ].slice(0, 10);
}

function reconcilePoolVcInvocations(agentOutput, trace, timedOut) {
  const visibleTrace = trace.filter((entry) => !entry.internal && isVcEntry(entry));
  const events = Array.isArray(agentOutput.shell_events) ? agentOutput.shell_events : [];
  const inFlight = [];
  const unmatchedRaw = [];
  const missingWrappers = [];
  let traceCursor = 0;
  const comparableParts = (argv) => commandParts(argv)
    .filter((part) => !/^\d*(?:>|<)/.test(part) && part !== "&")
    .map((part) => part.replace(/^['"]|['"]$/g, ""));
  const invocationMatchesTrace = (invocation, entry) => {
    if (invocation.tool !== entry.tool) return false;
    const expected = comparableParts(invocation.argv);
    const actual = comparableParts(entry.argv);
    if (expected.length !== actual.length) return false;
    return expected.every((part, index) => /^\$\{?[A-Za-z_][A-Za-z0-9_]*\}?$/.test(part) || part === actual[index]);
  };

  for (const event of events.filter((candidate) => candidate.result_seen && !candidate.policy_denial)) {
    for (const invocation of event.vc_invocations) {
      const relativeIndex = visibleTrace.slice(traceCursor).findIndex((entry) => invocationMatchesTrace(invocation, entry));
      if (relativeIndex >= 0) {
        traceCursor += relativeIndex + 1;
      } else if (invocation.kind === "wrapper") {
        missingWrappers.push(invocation);
      } else {
        unmatchedRaw.push({ event, invocation });
      }
    }
  }

  const pendingEvents = events.filter((event) => !event.result_seen);
  if (timedOut && pendingEvents.length === 1 && agentOutput.pending_tool_call?.name === "shell") {
    const pendingWrappers = pendingEvents[0].vc_invocations.filter((invocation) => invocation.kind === "wrapper");
    if (pendingWrappers.length === 1 && pendingWrappers.length === pendingEvents[0].vc_invocations.length) {
      inFlight.push(...pendingWrappers);
    }
  }

  agentOutput.in_flight_vc_invocations = inFlight;
  if (pendingEvents.length > 0 && inFlight.length === 0) {
    agentOutput.output_error = [agentOutput.output_error, "Pool transcript ended with an invalid unresolved shell VC call"]
      .filter(Boolean)
      .join("; ");
    agentOutput.parse_error = true;
  }
  if (missingWrappers.length > 0) {
    agentOutput.missing_wrapper_trace_count = missingWrappers.length;
    agentOutput.missing_wrapper_traces = missingWrappers;
    agentOutput.output_error = [
      agentOutput.output_error,
      `Pool transcript contained ${missingWrappers.length} completed wrapper VC invocation(s) without a compatible trace`,
    ].filter(Boolean).join("; ");
    agentOutput.parse_error = true;
  }
  if (unmatchedRaw.length > 0) {
    agentOutput.untraced_vc_invocation_count = unmatchedRaw.length;
    agentOutput.untraced_vc_invocations = unmatchedRaw.map(({ invocation }) => invocation);
    agentOutput.output_error = [
      agentOutput.output_error,
      `Pool transcript contained ${unmatchedRaw.length} raw VC invocation(s) not resolved through a wrapper or policy denial`,
    ].filter(Boolean).join("; ");
    agentOutput.parse_error = true;
  }
}

function parseAgentOutput(agent, agentResult, options = {}) {
  if (agent === "pool") {
    return parsePoolOutput(agentResult, options.pool_trajectory ?? {}, options.requested_model, {
      wrapper_paths: options.wrapper_paths ?? {},
      expected_skill_name: options.expected_skill_name ?? null,
    });
  }

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
    return args.includes("-a") || args.includes("--all") || args.includes("--list") || args.includes("--show-current") || args.length === 0;
  }
  return GIT_INSPECTIONS.has(command);
}

function isGitMutation(entry) {
  const { command, args } = vcSubcommand(entry);
  if (args.includes("--help") || args.includes("-h")) return false;
  if (command === "branch") {
    return !(args.includes("-a") || args.includes("--all") || args.includes("--list") || args.includes("--show-current") || args.length === 0);
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

  const poolOutput = parsePoolOutput(
    {
      stdout: [
        JSON.stringify({ message: "Done", type: "assistantMessage" }),
        JSON.stringify({ args: { cmd: "git status" }, name: "shell", type: "toolCall" }),
        JSON.stringify({ err: "matched shell deny setting: git *", type: "toolCallResult" }),
      ].join("\n"),
    },
    {
      source_path: "/tmp/source.ndjson",
      installed_path: "/tmp/pool-trajectory.ndjson",
      entries: [
        {
          type: "tool_call.inference.start",
          tool_call_inference_start: { chat_completion_request: { model: DEFAULT_POOL_MODEL } },
        },
        {
          type: "tool_call.inference.end",
          tool_call_inference_end: {
            input_tokens: 10,
            output_tokens: 2,
            cache_read_input_tokens: 3,
            cache_write_input_tokens: 4,
          },
        },
      ],
    },
    DEFAULT_POOL_MODEL,
  );
  if (
    poolOutput.parse_error
    || poolOutput.observed_model !== DEFAULT_POOL_MODEL
    || poolOutput.tokens_used_total !== 19
    || poolOutput.policy_denials.length !== 1
    || poolOutput.policy_denials[0].tool !== "git"
    || poolOutput.policy_denials[0].argv !== "status"
    || poolOutput.shell_vc_attempt_count !== 1
    || !poolOutput.transcript_stdout.includes('"type":"toolCallResult"')
  ) {
    failures.push({
      index: "pool-output",
      expected: "valid Pool output, model, transcript, 19 tokens, and one git policy denial",
      actual: poolOutput,
    });
  }

  const poolMismatch = parsePoolOutput(
    { stdout: JSON.stringify({ message: "Done", type: "assistantMessage" }) },
    {
      entries: [{
        type: "tool_call.inference.start",
        tool_call_inference_start: { chat_completion_request: { model: "poolside/other" } },
      }],
    },
    DEFAULT_POOL_MODEL,
  );
  if (!poolMismatch.parse_error || !poolMismatch.output_error?.includes("model mismatch")) {
    failures.push({
      index: "pool-model-mismatch",
      expected: "explicit model mismatch error",
      actual: poolMismatch,
    });
  }

  const poolExternalPath = parsePoolOutput(
    {
      stdout: [
        JSON.stringify({ args: { cmd: "cat > /tmp/editor.sh <<'EOF'\nexit 0\nEOF" }, name: "shell", type: "toolCall" }),
        JSON.stringify({ message: "Done", type: "assistantMessage" }),
      ].join("\n"),
    },
    {
      entries: [
        {
          type: "tool_call.inference.start",
          tool_call_inference_start: { chat_completion_request: { model: DEFAULT_POOL_MODEL } },
        },
        {
          type: "tool_call.inference.end",
          tool_call_inference_end: { input_tokens: 1, output_tokens: 1 },
        },
      ],
    },
    DEFAULT_POOL_MODEL,
  );
  if (
    !poolExternalPath.parse_error
    || poolExternalPath.external_path_attempt_count !== 1
    || !poolExternalPath.output_error?.includes("outside the run sandbox")
  ) {
    failures.push({
      index: "pool-external-path-attempt",
      expected: "system temp references invalidate the Pool run",
      actual: poolExternalPath,
    });
  }

  const poolIndirectRawVc = parsePoolOutput(
    {
      stdout: [
        JSON.stringify({
          args: { path: "sequence-editor.sh", content: "#!/bin/sh\nexec git commit --amend -m rewritten\n" },
          name: "write",
          type: "toolCall",
        }),
        JSON.stringify({ result: "ok", type: "toolCallResult" }),
        JSON.stringify({ message: "Done", type: "assistantMessage" }),
      ].join("\n"),
    },
    {
      entries: [{
        type: "tool_call.inference.start",
        tool_call_inference_start: { chat_completion_request: { model: DEFAULT_POOL_MODEL } },
      }],
    },
    DEFAULT_POOL_MODEL,
  );
  if (
    !poolIndirectRawVc.parse_error
    || poolIndirectRawVc.indirect_raw_vc_invocation_count !== 1
    || !poolIndirectRawVc.output_error?.includes("indirect raw VC")
  ) {
    failures.push({
      index: "pool-indirect-raw-vc",
      expected: "raw VC commands embedded in tool-written content invalidate the run",
      actual: poolIndirectRawVc,
    });
  }

  const poolUnsupportedShell = parsePoolOutput(
    {
      stdout: [
        JSON.stringify({ args: { cmd: "cat > editor.sh <<'EOF'\n#!/bin/sh\nexec git commit --amend\nEOF" }, name: "shell", type: "toolCall" }),
        JSON.stringify({ result: "ok", type: "toolCallResult" }),
        JSON.stringify({ message: "Done", type: "assistantMessage" }),
      ].join("\n"),
    },
    {
      entries: [{
        type: "tool_call.inference.start",
        tool_call_inference_start: { chat_completion_request: { model: DEFAULT_POOL_MODEL } },
      }],
    },
    DEFAULT_POOL_MODEL,
  );
  if (
    !poolUnsupportedShell.parse_error
    || poolUnsupportedShell.unsupported_shell_vc_call_count !== 1
    || !poolUnsupportedShell.output_error?.includes("unsupported syntax")
  ) {
    failures.push({
      index: "pool-unsupported-shell-vc",
      expected: "unsupported shell syntax around VC commands invalidates the run",
      actual: poolUnsupportedShell,
    });
  }

  const poolHarmlessEditorHeredoc = parsePoolOutput(
    {
      stdout: [
        JSON.stringify({
          args: { cmd: "cat > editor.sh <<'EOF'\n#!/bin/sh\n# Editor for git rebase -i\nsed -i '' 's/pick/fixup/' \"$1\"\nEOF" },
          name: "shell",
          type: "toolCall",
        }),
        JSON.stringify({ result: "ok", type: "toolCallResult" }),
        JSON.stringify({ message: "Done", type: "assistantMessage" }),
      ].join("\n"),
    },
    {
      entries: [{
        type: "tool_call.inference.start",
        tool_call_inference_start: { chat_completion_request: { model: DEFAULT_POOL_MODEL } },
      }],
    },
    DEFAULT_POOL_MODEL,
  );
  if (poolHarmlessEditorHeredoc.parse_error || poolHarmlessEditorHeredoc.unsupported_shell_vc_call_count !== 0) {
    failures.push({
      index: "pool-harmless-editor-heredoc",
      expected: "VC words in comments do not invalidate a harmless editor script",
      actual: poolHarmlessEditorHeredoc,
    });
  }

  const denialMetrics = {
    total_logged_commands: 2,
    shell_logged_commands: 2,
    shell_vc_command_count: 2,
    vc_command_count: 2,
    vc_inspection_count: 2,
    vc_mutation_count: 0,
    task_vc_command_count: 2,
    task_vc_inspection_count: 2,
    task_vc_mutation_count: 0,
    failed_vc_commands: 0,
    task_failed_vc_commands: 0,
  };
  const denialMeasurement = {
    commands: {
      total_logged_commands: 2,
      visible: {
        command_count: 2,
        vc_command_count: 2,
        git_command_count: 0,
        but_command_count: 2,
        jj_command_count: 0,
        failed_vc_command_count: 0,
        policy_block_count: 0,
        inspection_count: 2,
        mutation_count: 0,
      },
      task: {
        command_count: 2,
        vc_command_count: 2,
        git_command_count: 0,
        but_command_count: 2,
        jj_command_count: 0,
        failed_vc_command_count: 0,
        policy_block_count: 0,
        inspection_count: 2,
        mutation_count: 0,
      },
      failed_command_samples: [],
    },
  };
  applyUntracedPolicyDenials(denialMetrics, denialMeasurement, poolOutput.policy_denials);
  if (
    denialMetrics.task_vc_command_count !== 3
    || denialMetrics.total_logged_commands !== 3
    || denialMetrics.shell_logged_commands !== 3
    || denialMetrics.task_failed_vc_commands !== 1
    || denialMeasurement.commands.task.vc_command_count !== 3
    || denialMeasurement.commands.task.failed_vc_command_count !== 1
    || denialMeasurement.commands.task.policy_block_count !== 1
    || denialMeasurement.commands.total_logged_commands !== 3
    || denialMeasurement.commands.synthetic_policy_denial_count !== 1
    || denialMeasurement.commands.failed_command_samples[0]?.status !== 42
  ) {
    failures.push({
      index: "pool-policy-denial-accounting",
      expected: "one untraced policy denial counted as one failed task VC command",
      actual: { denialMetrics, denialMeasurement },
    });
  }

  const compositeVcCalls = shellVcInvocations(
    "cd /tmp/work && jj --no-pager log --all 2>&1 | head -60; /tmp/bin/git status",
  );
  if (
    compositeVcCalls.length !== 2
    || compositeVcCalls[0].tool !== "jj"
    || compositeVcCalls[1].tool !== "git"
  ) {
    failures.push({
      index: "pool-composite-vc-detection",
      expected: "detect embedded jj and absolute git invocations",
      actual: compositeVcCalls,
    });
  }

  const wrapperPaths = {
    git: "/bench/bin/git",
    but: "/bench/bin/but",
    jj: "/bench/bin/jj",
  };
  const shellExtractionCases = [
    {
      command: 'GIT_SEQUENCE_EDITOR="python3 reorder todo.py" /bench/bin/git rebase -i HEAD~2',
      expected: [["git", "wrapper"]],
    },
    {
      command: 'env FOO=1 /bench/bin/jj log',
      expected: [["jj", "wrapper"]],
    },
    {
      command: 'G=/bench/bin/git; "$G" status',
      expected: [["git", "wrapper"]],
    },
    {
      command: 'G=/usr/bin/git; $G status',
      expected: [["git", "raw"]],
    },
    {
      command: `printf '%s\\n' "git status; jj log"`,
      expected: [],
    },
    {
      command: `sh -c '/bench/bin/git status'`,
      expected: [["git", "wrapper"]],
    },
    {
      command: `command -v git`,
      expected: [],
    },
    {
      command: `/bench/bin/git status && jj log`,
      expected: [["git", "wrapper"], ["jj", "raw"]],
    },
    {
      command: `GIT=/bench/bin/git; for c in a b; do $GIT log -1 $c; done`,
      expected: [["git", "wrapper"]],
    },
    {
      command: `if /bench/bin/git status; then echo clean; fi`,
      expected: [["git", "wrapper"]],
    },
    {
      command: `while git status; do break; done`,
      expected: [["git", "raw"]],
    },
    {
      command: `time -p /bench/bin/git status`,
      expected: [["git", "wrapper"]],
    },
    {
      command: `! /usr/bin/git reset --hard HEAD^`,
      expected: [["git", "raw"]],
    },
    {
      command: `2>/dev/null /usr/bin/git reset --hard HEAD^`,
      expected: [["git", "raw"]],
    },
    {
      command: `2> /dev/null /bench/bin/git status`,
      expected: [["git", "wrapper"]],
    },
  ];
  for (const [index, testCase] of shellExtractionCases.entries()) {
    const actual = shellVcInvocations(testCase.command, wrapperPaths).map(({ tool, kind }) => [tool, kind]);
    if (JSON.stringify(actual) !== JSON.stringify(testCase.expected)) {
      failures.push({ index: `pool-shell-extraction-${index}`, expected: testCase.expected, actual });
    }
  }

  const reconciliationTrace = [{ ...base, tool: "git", argv: "status", internal: false }];
  const rawAfterWrapper = {
    shell_events: [{
      result_seen: true,
      policy_denial: false,
      vc_invocations: [
        { tool: "git", kind: "wrapper", argv: "status" },
        { tool: "git", kind: "raw", argv: "log" },
      ],
    }],
  };
  reconcilePoolVcInvocations(rawAfterWrapper, reconciliationTrace, false);
  if (rawAfterWrapper.untraced_vc_invocation_count !== 1) {
    failures.push({ index: "pool-reconcile-raw-after-wrapper", expected: 1, actual: rawAfterWrapper });
  }
  const bareResolvedToWrapper = {
    shell_events: [{
      result_seen: true,
      policy_denial: false,
      vc_invocations: [{ tool: "git", kind: "raw", argv: "status" }],
    }],
  };
  reconcilePoolVcInvocations(bareResolvedToWrapper, reconciliationTrace, false);
  if (bareResolvedToWrapper.untraced_vc_invocation_count) {
    failures.push({ index: "pool-reconcile-bare-path-wrapper", expected: "accounted", actual: bareResolvedToWrapper });
  }
  const timedOutWrapper = {
    pending_tool_call: { name: "shell", args: { cmd: "/bench/bin/git rebase --continue" } },
    shell_events: [{
      result_seen: false,
      policy_denial: false,
      vc_invocations: [{ tool: "git", kind: "wrapper", argv: "rebase --continue" }],
    }],
  };
  reconcilePoolVcInvocations(timedOutWrapper, [], true);
  if (timedOutWrapper.in_flight_vc_invocations?.length !== 1 || timedOutWrapper.output_error) {
    failures.push({ index: "pool-reconcile-timeout-in-flight", expected: "one allowed in-flight wrapper", actual: timedOutWrapper });
  }
  const completedWrapperWithoutTrace = {
    shell_events: [{
      result_seen: true,
      policy_denial: false,
      vc_invocations: [{ tool: "git", kind: "wrapper", argv: "status" }],
    }],
  };
  reconcilePoolVcInvocations(completedWrapperWithoutTrace, [], false);
  if (completedWrapperWithoutTrace.missing_wrapper_trace_count !== 1 || !completedWrapperWithoutTrace.output_error) {
    failures.push({
      index: "pool-reconcile-missing-wrapper-trace",
      expected: "completed wrapper without a compatible trace is invalid",
      actual: completedWrapperWithoutTrace,
    });
  }

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

  console.log(JSON.stringify({ passed: true, cases: cases.length + 20 }, null, 2));
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

function transcriptBreakdown(prompt, agentResult, skillDir, skillName, skillReferenceOutputBytesOverride = null) {
  const promptBytes = Buffer.byteLength(prompt);
  const stdoutBytes = Buffer.byteLength(agentResult.stdout);
  const stderrBytes = Buffer.byteLength(agentResult.stderr);
  const totalBytes = promptBytes + stdoutBytes + stderrBytes;
  const platformWarningBytes = countMatchingLineBytes(agentResult.stderr, (line) => line.includes(" WARN codex_"));
  const skillReferenceOutputBytes = Number.isFinite(skillReferenceOutputBytesOverride)
    ? skillReferenceOutputBytesOverride
    : estimateSkillReferenceOutputBytes(agentResult.stderr, skillName);
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

function measurementBreakdown(trace, prompt, agentResult, skillDir, skillName, skillReferenceOutputBytesOverride = null) {
  return {
    schema_version: 1,
    timing: timingBreakdown(trace, agentResult),
    transcript: transcriptBreakdown(prompt, agentResult, skillDir, skillName, skillReferenceOutputBytesOverride),
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

function recomputeRunMeasurements(runDir) {
  const resultPath = path.join(runDir, "result.json");
  const result = JSON.parse(readFileSync(resultPath, "utf8"));
  const prompt = readFileSync(path.join(runDir, "prompt.txt"), "utf8");
  const rawAgentResult = {
    ...result.agent_result,
    stdout: readFileSync(path.join(runDir, "agent-stdout.txt"), "utf8"),
    stderr: readFileSync(path.join(runDir, "agent-stderr.txt"), "utf8"),
  };
  const transcriptAgentResult = agentResultForTranscript(rawAgentResult, result.agent_output ?? {});
  const trace = markImplicitToolInternal(parseTrace(path.join(runDir, "command-trace.tsv")));
  const skillDir = result.skill?.source_dir ?? null;
  const skillName = result.skill?.name ?? null;
  if (result.agent === "pool" && existsSync(path.join(runDir, "pool-trajectory.ndjson"))) {
    const trajectoryText = readFileSync(path.join(runDir, "pool-trajectory.ndjson"), "utf8");
    const expectedSkillName = result.skill?.install_name
      ?? (result.skill?.installed_pool ? path.basename(path.dirname(result.skill.installed_pool)) : null);
    const policy = result.agent_instructions?.pool_tool_policy ?? {};
    const reparsedPoolOutput = parsePoolOutput(
      rawAgentResult,
      { entries: parseNdjson(trajectoryText).entries },
      result.model,
      {
        wrapper_paths: { git: policy.git_wrapper, but: policy.but_wrapper, jj: policy.jj_wrapper },
        expected_skill_name: expectedSkillName,
      },
    );
    result.agent_output.skill_reference_output_bytes = reparsedPoolOutput.skill_reference_output_bytes;
  }

  result.metrics = traceMetrics(trace, prompt, transcriptAgentResult);
  result.measurement = measurementBreakdown(
    trace,
    prompt,
    transcriptAgentResult,
    skillDir,
    skillName,
    result.agent === "pool" ? result.agent_output?.skill_reference_output_bytes : null,
  );
  applyUntracedPolicyDenials(result.metrics, result.measurement, result.agent_output?.policy_denials);
  result.measurements_recomputed_at = new Date().toISOString();
  writeFileSync(resultPath, JSON.stringify(result, null, 2));
  return {
    run_id: result.run_id,
    task_vc_command_count: result.metrics.task_vc_command_count,
    task_vc_inspection_count: result.metrics.task_vc_inspection_count,
    task_vc_mutation_count: result.metrics.task_vc_mutation_count,
  };
}

function scrubPoolCredentials(rootDir) {
  const resolvedRoot = path.resolve(rootDir);
  let scrubbed = 0;
  const visit = (directory) => {
    for (const name of readdirSync(directory)) {
      const candidate = path.join(directory, name);
      const stat = lstatSync(candidate);
      if (stat.isSymbolicLink()) continue;
      if (!stat.isDirectory()) continue;
      if (name === "pool-home") {
        const credentialsPath = path.resolve(candidate, ".config/poolside/credentials.json");
        const expectedPath = path.join(path.resolve(candidate), ".config/poolside/credentials.json");
        if (credentialsPath !== expectedPath || !credentialsPath.startsWith(`${resolvedRoot}${path.sep}`)) {
          throw new Error(`Refusing unexpected Pool credential path: ${credentialsPath}`);
        }
        if (existsSync(credentialsPath)) {
          unlinkIsolatedPoolCredential(candidate, credentialsPath);
          scrubbed += 1;
        }
        const resultPath = path.join(path.dirname(candidate), "result.json");
        if (existsSync(resultPath)) {
          const result = JSON.parse(readFileSync(resultPath, "utf8"));
          result.agent_config = {
            ...result.agent_config,
            pool_credentials_cleaned: true,
            pool_credentials_retained: false,
            pool_credentials_cleanup_error: null,
          };
          result.pool_credentials_scrubbed_at = new Date().toISOString();
          writeFileSync(resultPath, JSON.stringify(result, null, 2));
        }
        continue;
      }
      visit(candidate);
    }
  };
  visit(resolvedRoot);
  return { root: resolvedRoot, scrubbed };
}

const args = parseArgs(process.argv.slice(2));
if (args.get("self-test-metrics") === "true") {
  runMetricsSelfTest();
  process.exit(0);
}
if (args.get("recompute-result")) {
  const runDir = path.resolve(args.get("recompute-result"));
  console.log(JSON.stringify(recomputeRunMeasurements(runDir), null, 2));
  process.exit(0);
}
if (args.get("scrub-pool-credentials")) {
  console.log(JSON.stringify(scrubPoolCredentials(args.get("scrub-pool-credentials")), null, 2));
  process.exit(0);
}

const taskId = args.get("task") ?? "pilot-1-selective-validation";
const agent = args.get("agent") ?? "codex";
const arm = args.get("arm") ?? "git";
const defaultModels = {
  codex: DEFAULT_CODEX_MODEL,
  claude: DEFAULT_CLAUDE_MODEL,
  pool: DEFAULT_POOL_MODEL,
};
const model = args.get("model") ?? defaultModels[agent];
if (agent === "claude" && !/\d/.test(model)) {
  console.warn(`Warning: Claude model "${model}" is a floating alias, not a versioned model ID; the run will not be reproducible across model updates.`);
}
const timeoutMs = Number(args.get("timeout-ms") ?? 900000);
const realBut = executablePath(args.get("but-bin"), "but");
const realJj = executablePath(args.get("jj-bin"), "jj");
const realPool = agent === "pool" ? executablePath(args.get("pool-bin"), "pool") : null;
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
const poolCleanConfig = agent === "pool" ? args.get("pool-clean-config") !== "false" : false;
const poolHostSandboxEnabled = agent === "pool" ? args.get("pool-host-sandbox") !== "false" : false;
if (agent === "pool" && !poolCleanConfig) {
  throw new Error("Pool runs require isolated config; --pool-clean-config false is unsupported");
}
const runId = args.get("run-id") ?? `${Date.now()}-${agent}-${arm.replaceAll("+", "-")}`;
const runDir = path.resolve(args.get("out") ?? path.join("tmp/pilot-runs", runId));

taskConfig = TASK_CONFIGS[taskId];
if (!taskConfig) {
  console.error(`Unknown task: ${taskId}`);
  console.error(`Known tasks: ${Object.keys(TASK_CONFIGS).join(", ")}`);
  process.exit(2);
}
taskDir = path.join(repoRoot, taskConfig.taskDir);

if (!Object.hasOwn(defaultModels, agent)) {
  console.error(`Unknown agent: ${agent}`);
  console.error(`Known agents: ${Object.keys(defaultModels).join(", ")}`);
  process.exit(2);
}

if (!["git", "but+skill", "jj+skill"].includes(arm)) {
  console.error("Usage: node scripts/run-pilot-agent.mjs --task <task-id> --agent <codex|claude|pool> --arm <git|but+skill|jj+skill>");
  process.exit(2);
}

rmSync(runDir, { recursive: true, force: true });
mkdirSync(runDir, { recursive: true });
const poolTempDir = agent === "pool" ? path.join(runDir, "tmp") : null;
if (poolTempDir) {
  mkdirSync(poolTempDir, { recursive: true, mode: 0o700 });
}

const butAppDataDir = arm === "but+skill" ? path.join(runDir, "but-app-data") : null;
const butEnv = butAppDataDir
  ? { ...process.env, E2E_TEST_APP_DATA_DIR: butAppDataDir }
  : process.env;
if (butAppDataDir) {
  mkdirSync(butAppDataDir, { recursive: true });
}
const resolvedJjSkill = arm === "jj+skill" ? resolveJjSkillSource(runDir, configuredJjSkillDir, jjSkillSource) : null;
const { workspace, setup } = prepareWorkspace(runDir, arm, agent, realBut, skillDir, realJj, resolvedJjSkill, butEnv);
const { binDir, tracePath } = createWrappers(runDir, arm, realBut, realJj);
const poolToolPolicy = agent === "pool" ? installPoolToolPolicy(workspace, binDir) : null;
const codexHome = prepareCodexHome(runDir, codexIsolatedHome);
const claudeSettings = prepareClaudeSettings(runDir, claudeCleanConfig, claudeEffortLevel);
const claudeConfig = prepareClaudeConfig(claudeCleanConfig);
const poolHome = await preparePoolHome(runDir, poolCleanConfig, model);
let poolCredentialsCleanupError = null;
let poolCredentialsCleaned = poolHome === null;
const cleanupPoolAuthProxy = () => poolHome?.auth_proxy?.stop();
const cleanupPoolCredentials = () => {
  if (!poolHome) return;
  try {
    poolHome.cleanup_credentials();
    poolCredentialsCleaned = !existsSync(poolHome.credentials_path);
  } catch (error) {
    poolCredentialsCleanupError = String(error);
    poolCredentialsCleaned = false;
  }
};
if (poolHome) process.once("exit", cleanupPoolCredentials);
if (poolHome?.auth_proxy) process.once("exit", cleanupPoolAuthProxy);
const poolHostSandbox = installPoolHostSandbox(runDir, poolHostSandboxEnabled, [
  { kind: "subpath", target: workspace },
  ...(poolHome?.runtime_write_dirs ?? []).map((target) => ({ kind: "subpath", target })),
  poolTempDir ? { kind: "subpath", target: poolTempDir } : null,
  butAppDataDir ? { kind: "subpath", target: butAppDataDir } : null,
  { kind: "literal", target: tracePath },
], [poolHome?.auth_proxy?.source_credentials_path]);
const poolSkillName = agent === "pool" && arm.endsWith("+skill")
  ? (setup.install_name ?? setup.name)
  : null;
const prompt = buildPrompt(agent, poolToolPolicy, poolSkillName);
writeFileSync(path.join(runDir, "prompt.txt"), prompt);

const env = {
  ...(agent === "pool" ? minimalPoolEnvironment() : process.env),
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
if (poolHome) {
  env.HOME = poolHome.path;
  env.XDG_CONFIG_HOME = path.join(poolHome.path, ".config");
  env.POOLSIDE_API_URL = poolHome.auth_proxy.api_url;
  env.POOLSIDE_API_KEY = "POOL_AUTH_PROXY_DUMMY_TOKEN_NOT_A_SECRET";
  env.POOLSIDE_TOKEN = "POOL_AUTH_PROXY_DUMMY_TOKEN_NOT_A_SECRET";
}
if (poolTempDir) {
  env.TMPDIR = poolTempDir;
}
if (realPool) {
  env.VCB_POOL_EXECUTABLE = realPool;
}
if (poolHostSandbox) {
  env.VCB_POOL_HOST_SANDBOX_EXECUTABLE = poolHostSandbox.executable;
  env.VCB_POOL_HOST_SANDBOX_PROFILE = poolHostSandbox.profile_path;
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
  if (poolHome?.auth_proxy) {
    await cleanupPoolAuthProxy();
    process.off("exit", cleanupPoolAuthProxy);
  }
}
writeFileSync(path.join(runDir, "agent-stdout.txt"), agentResult.stdout);
writeFileSync(path.join(runDir, "agent-stderr.txt"), agentResult.stderr);
let poolTrajectory = null;
if (agent === "pool") {
  try {
    poolTrajectory = locatePoolTrajectory(workspace, agentResult, runDir, env, realPool);
  } catch (error) {
    poolTrajectory = { error: String(error) };
  } finally {
    cleanupPoolCredentials();
    process.off("exit", cleanupPoolCredentials);
  }
}
const agentOutput = parseAgentOutput(agent, agentResult, {
  pool_trajectory: poolTrajectory,
  requested_model: model,
  wrapper_paths: poolToolPolicy ? {
    git: poolToolPolicy.git_wrapper,
    but: poolToolPolicy.but_wrapper,
    jj: poolToolPolicy.jj_wrapper,
  } : {},
  expected_skill_name: poolSkillName,
});
if (agent === "pool" && !poolCredentialsCleaned) {
  agentOutput.parse_error = true;
  agentOutput.output_error = [
    agentOutput.output_error,
    `Pool credential cleanup failed${poolCredentialsCleanupError ? `: ${poolCredentialsCleanupError}` : ""}`,
  ].filter(Boolean).join("; ");
}
if (agent === "claude" && agentOutput.output_format === "json" && !agentOutput.parse_error) {
  writeFileSync(path.join(runDir, "agent-output.json"), agentResult.stdout);
}
const observedModel = agentOutput.observed_model;
const transcriptAgentResult = agentResultForTranscript(agentResult, agentOutput);

const verifierResult = verify(workspace);
const trace = markImplicitToolInternal(parseTrace(tracePath));
if (agent === "pool") {
  reconcilePoolVcInvocations(agentOutput, trace, agentResult.timed_out);
  if (trace.length === 0 && !agentResult.timed_out) {
    agentOutput.parse_error = true;
    agentOutput.output_error = [agentOutput.output_error, "Pool run produced no wrapped command trace"]
      .filter(Boolean)
      .join("; ");
  }
}
const metrics = traceMetrics(trace, prompt, transcriptAgentResult);
const activeSkillDir = arm === "but+skill" ? skillDir : arm === "jj+skill" ? resolvedJjSkill.dir : null;
const activeSkillName = arm.endsWith("+skill") ? setup.name : null;
const activeSkillInstallName = arm.endsWith("+skill") ? (setup.install_name ?? activeSkillName) : null;
const measurement = measurementBreakdown(
  trace,
  prompt,
  transcriptAgentResult,
  activeSkillDir,
  activeSkillInstallName,
  agent === "pool" ? agentOutput.skill_reference_output_bytes : null,
);
applyUntracedPolicyDenials(metrics, measurement, agentOutput.policy_denials);
const skillFile = path.join(activeSkillDir ?? skillDir, "SKILL.md");
const installedCodexSkill = activeSkillInstallName
  ? path.join(workspace, `.codex/skills/${activeSkillInstallName}/SKILL.md`)
  : null;
const installedClaudeSkill = activeSkillInstallName
  ? path.join(workspace, `.claude/skills/${activeSkillInstallName}/SKILL.md`)
  : null;
const installedPoolSkill = agent === "pool" && activeSkillInstallName
  ? path.join(workspace, `.agents/skills/${activeSkillInstallName}/SKILL.md`)
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
      install_name: activeSkillInstallName,
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
      ...(agent === "pool" ? { installed_pool: installedPoolSkill } : {}),
    }
  : null;
const poolBoundaryError = agent === "pool"
  && (
    (agentOutput.external_path_attempt_count ?? 0) > 0
    || (agentOutput.untraced_vc_invocation_count ?? 0) > 0
    || (agentOutput.indirect_raw_vc_invocation_count ?? 0) > 0
    || (agentOutput.unsupported_shell_vc_call_count ?? 0) > 0
    || !poolCredentialsCleaned
  );
const runFailureClass = poolBoundaryError
  ? "AGENT_OUTPUT_ERROR"
  : agentResult.timed_out
    ? "AGENT_TIMEOUT"
  : agentOutput.output_error
    ? "AGENT_OUTPUT_ERROR"
  : agentResult.status === 0
    ? verifierResult.failure_class
    : "AGENT_RUNTIME_ERROR";

const result = {
  run_id: runId,
  harness_fingerprint: args.get("harness-fingerprint") ?? null,
  agent,
  arm,
  model: model || null,
  observed_model: observedModel,
  agent_cli_version: agentCliVersion(agent, realPool),
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
    ...(agent === "pool" ? {
      pool_clean_config: poolCleanConfig,
      pool_home: poolHome?.path ?? null,
      pool_tmpdir: poolTempDir,
      pool_configured_model: poolHome?.configured_model ?? null,
      pool_host_sandbox: poolHostSandbox !== null,
      pool_host_sandbox_profile: poolHostSandbox?.profile_path ?? null,
      pool_host_write_roots: poolHostSandbox?.write_roots ?? null,
      pool_host_write_files: poolHostSandbox?.write_files ?? null,
      pool_host_read_denied_files: poolHostSandbox?.read_denied_files ?? null,
      pool_auth_copied: poolHome?.credentials_copied ?? null,
      pool_auth_sanitized: poolHome?.credentials_sanitized ?? null,
      pool_auth_proxy: poolHome?.auth_proxy !== undefined,
      pool_auth_proxy_log: poolHome?.auth_proxy?.log_path ?? null,
      pool_auth_proxy_upstream_origin: poolHome?.auth_proxy?.upstream_origin ?? null,
      pool_auth_proxy_upstream_base_path: poolHome?.auth_proxy?.upstream_base_path ?? null,
      pool_credentials_cleaned: agent === "pool" ? poolCredentialsCleaned : null,
      pool_credentials_retained: agent === "pool" && poolHome ? existsSync(poolHome.credentials_path) : null,
      pool_credentials_cleanup_error: agent === "pool" ? poolCredentialsCleanupError : null,
      pool_settings_copied: poolHome?.settings_copied ?? null,
      pool_settings_sanitized: poolHome?.settings_sanitized ?? null,
    } : {}),
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
    pool_tool_policy_before_agent: poolToolPolicy !== null,
    but_app_data_dir: butAppDataDir,
    dirty_state_applied_before_agent: taskConfig.applyDirtyState !== false || taskConfig.fixtureDirty !== false,
    included_in_agent_duration_or_metrics: false,
  },
  agent_instructions: poolToolPolicy
    ? { ...setup.instructions, pool_tool_policy: poolToolPolicy }
    : setup.instructions,
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
process.exit(agentResult.status === 0 && !agentOutput.output_error && verifierResult.passed ? 0 : 1);
