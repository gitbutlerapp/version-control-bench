#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib/args.mjs";
import { initBenchmarkRepo, prepareFixtureDir } from "./lib/fixture.mjs";
import { git, run } from "./lib/process.mjs";
import { BASELINE_FILES } from "./lib/pilot1-content.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const args = parseArgs(process.argv.slice(2));
const outDir = path.resolve(args.get("out") ?? "tmp/pilot-1-workspace");
const force = args.get("force") === "true";
const dirty = args.get("dirty") !== "false";

prepareFixtureDir(outDir, { force });
initBenchmarkRepo(outDir);

run("node", [path.join(repoRoot, "scripts/apply-pilot-state.mjs"), "baseline", outDir], { cwd: repoRoot });
git(outDir, ["add", ...Object.keys(BASELINE_FILES)]);
git(outDir, ["commit", "-m", "Initial lead intake service"]);

if (dirty) {
  run("node", [path.join(repoRoot, "scripts/apply-pilot-state.mjs"), "dirty", outDir], { cwd: repoRoot });
}

console.log(outDir);
