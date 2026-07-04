#!/usr/bin/env node
// Export the publishable per-run evidence for a batch: transcripts, command
// traces, prompts, result.json, runner logs, batch summaries, and a compact
// final-Git-state snapshot per run. Workspaces themselves stay local; the
// export is bounded, scanned for secret-shaped strings, and tarballed so it
// can be attached to a release.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { parseArgs } from "./lib/args.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const RUN_FILES = [
  "result.json",
  "command-trace.tsv",
  "agent-stdout.txt",
  "agent-stderr.txt",
  "agent-output.json",
  "prompt.txt",
  "claude-settings.json",
];
const BATCH_FILES = ["aggregate.json", "manifest.tsv", "report.md", "plan.tsv", "progress.tsv", "but-build.log"];

// Concrete credential prefixes only; generic entropy heuristics false-positive
// on SHA-256 provenance hashes, which these artifacts are full of.
const SECRET_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{8,}/,
  /sk-proj-[A-Za-z0-9_-]{8,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

function git(repoDir, args) {
  const result = spawnSync("git", args, { cwd: repoDir, encoding: "utf8" });
  if (result.status !== 0) return `<git ${args[0]} failed: ${(result.stderr ?? "").trim()}>`;
  return result.stdout;
}

function finalStateSnapshot(workspace) {
  return [
    "# Final Git-visible state exported from the run workspace",
    "",
    "## git log --all --graph --format='%h %d %s'",
    git(workspace, ["log", "--all", "--graph", "--format=%h %d %s"]),
    "## git for-each-ref",
    git(workspace, ["for-each-ref", "--format=%(refname) %(objectname)"]),
    "## git status --porcelain=v2 --branch",
    git(workspace, ["status", "--porcelain=v2", "--branch"]),
    "## git diff --stat",
    git(workspace, ["diff", "--stat"]),
    "## git diff --cached --stat",
    git(workspace, ["diff", "--cached", "--stat"]),
  ].join("\n");
}

function scanForSecrets(filePath) {
  const text = readFileSync(filePath, "utf8");
  return SECRET_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => String(pattern));
}

const args = parseArgs(process.argv.slice(2));
const batchName = args.get("batch");
if (!batchName) {
  console.error("Usage: node scripts/export-batch-artifacts.mjs --batch <batch-name> [--out <dir>]");
  process.exit(1);
}
const batchDir = path.resolve(args.get("batch-dir") ?? path.join(repoRoot, "tmp/pilot-runs", batchName));
if (!existsSync(batchDir)) {
  console.error(`Batch directory not found: ${batchDir}`);
  process.exit(1);
}
const outRoot = path.resolve(args.get("out") ?? path.join(repoRoot, "tmp/exports"));
const outDir = path.join(outRoot, batchName);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const findings = [];
const copied = [];

function exportFile(src, dest) {
  if (!existsSync(src)) return false;
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  const hits = scanForSecrets(dest);
  if (hits.length > 0) findings.push({ file: path.relative(outDir, dest), patterns: hits });
  copied.push(dest);
  return true;
}

for (const name of BATCH_FILES) {
  exportFile(path.join(batchDir, name), path.join(outDir, name));
}

const runDirs = readdirSync(batchDir).filter((entry) => {
  const full = path.join(batchDir, entry);
  return statSync(full).isDirectory() && existsSync(path.join(full, "result.json"));
});

const index = [];
for (const runName of runDirs.sort()) {
  const runDir = path.join(batchDir, runName);
  const destDir = path.join(outDir, "runs", runName);
  for (const name of RUN_FILES) {
    exportFile(path.join(runDir, name), path.join(destDir, name));
  }
  exportFile(path.join(batchDir, `${runName}.log`), path.join(destDir, "runner.log"));

  const workspace = path.join(runDir, "workspace");
  if (existsSync(path.join(workspace, ".git"))) {
    const snapshotPath = path.join(destDir, "final-state.txt");
    writeFileSync(snapshotPath, finalStateSnapshot(workspace));
    copied.push(snapshotPath);
  }

  const result = JSON.parse(readFileSync(path.join(runDir, "result.json"), "utf8"));
  index.push({
    run_id: result.run_id ?? runName,
    task: typeof result.task === "string" ? result.task : result.task?.id ?? null,
    agent: result.agent ?? null,
    arm: result.arm ?? null,
    model: result.observed_model ?? result.model ?? null,
    passed: result.verifier?.passed ?? null,
    failure_class: result.run_failure_class ?? null,
    wall_ms: result.agent_result?.duration_ms ?? null,
    path: `runs/${runName}`,
  });
}

writeFileSync(
  path.join(outDir, "index.json"),
  JSON.stringify(
    {
      batch: batchName,
      generated_at: new Date().toISOString(),
      run_count: index.length,
      pass_count: index.filter((entry) => entry.passed === true).length,
      contents: "Per-run agent transcripts, command traces, prompts, result.json, runner logs, and final Git-state snapshots. Workspaces are reproducible from the fixture scripts in the vcbench repo.",
      runs: index,
    },
    null,
    2,
  ),
);

if (findings.length > 0) {
  console.error("Secret-shaped strings found; export aborted. Review before publishing:");
  for (const finding of findings) console.error(`  ${finding.file}: ${finding.patterns.join(", ")}`);
  rmSync(outDir, { recursive: true, force: true });
  process.exit(1);
}

const tarball = path.join(outRoot, `${batchName}-artifacts.tar.gz`);
rmSync(tarball, { force: true });
const tar = spawnSync("tar", ["-czf", tarball, "-C", outRoot, batchName], { encoding: "utf8" });
if (tar.status !== 0) {
  console.error(`tar failed: ${tar.stderr}`);
  process.exit(1);
}
const sha256 = createHash("sha256").update(readFileSync(tarball)).digest("hex");
const sizeMb = (statSync(tarball).size / (1024 * 1024)).toFixed(1);

console.log(`Exported ${index.length} runs (${copied.length} files) to ${path.relative(repoRoot, outDir)}`);
console.log(`Tarball: ${path.relative(repoRoot, tarball)} (${sizeMb} MB)`);
console.log(`SHA-256: ${sha256}`);
