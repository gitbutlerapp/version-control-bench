import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { git, run } from "./process.mjs";

export function prepareFixtureDir(outDir, { force = false } = {}) {
  if (existsSync(outDir)) {
    if (!force) {
      console.error(`Refusing to overwrite existing directory: ${outDir}`);
      console.error("Pass --force true to replace it.");
      process.exit(2);
    }
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });
}

export function initBenchmarkRepo(repoDir) {
  run("git", ["init", "-b", "main"], { cwd: repoDir });
  git(repoDir, ["config", "user.name", "Bench Author"]);
  git(repoDir, ["config", "user.email", "bench@example.com"]);
  git(repoDir, ["config", "commit.gpgsign", "false"]);
}

export function syncFileState(repoDir, files, allKnownPaths) {
  for (const relativePath of allKnownPaths) {
    if (!(relativePath in files) || files[relativePath] === undefined) {
      rmSync(path.join(repoDir, relativePath), { force: true });
    }
  }

  for (const [relativePath, content] of Object.entries(files)) {
    if (content === undefined) continue;
    const fullPath = path.join(repoDir, relativePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, "utf8");
  }
}

export function commitFileState(repoDir, state, allKnownPaths) {
  syncFileState(repoDir, state.files, allKnownPaths);
  git(repoDir, ["add", "-A"]);
  git(repoDir, ["commit", "-m", state.subject]);
}

export function commitStateSeries(repoDir, states, allKnownPaths) {
  for (const state of states) {
    commitFileState(repoDir, state, allKnownPaths);
  }
}
