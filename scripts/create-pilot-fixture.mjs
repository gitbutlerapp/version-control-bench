#!/usr/bin/env node
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { git, run } from "./lib/process.mjs";
import { BASELINE_FILES } from "./lib/pilot1-content.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

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

const args = parseArgs(process.argv.slice(2));
const outDir = path.resolve(args.get("out") ?? "tmp/pilot-1-workspace");
const force = args.get("force") === "true";
const dirty = args.get("dirty") !== "false";

if (existsSync(outDir)) {
  if (!force) {
    console.error(`Refusing to overwrite existing directory: ${outDir}`);
    console.error("Pass --force true to replace it.");
    process.exit(2);
  }
  rmSync(outDir, { recursive: true, force: true });
}

mkdirSync(outDir, { recursive: true });
run("git", ["init", "-b", "main"], { cwd: outDir });
git(outDir, ["config", "user.name", "Bench Author"]);
git(outDir, ["config", "user.email", "bench@example.com"]);
git(outDir, ["config", "commit.gpgsign", "false"]);

run("node", [path.join(repoRoot, "scripts/apply-pilot-state.mjs"), "baseline", outDir], { cwd: repoRoot });
git(outDir, ["add", ...Object.keys(BASELINE_FILES)]);
git(outDir, ["commit", "-m", "Initial lead intake service"]);

if (dirty) {
  run("node", [path.join(repoRoot, "scripts/apply-pilot-state.mjs"), "dirty", outDir], { cwd: repoRoot });
}

console.log(outDir);
