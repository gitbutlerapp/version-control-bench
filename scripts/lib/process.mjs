import { spawnSync } from "node:child_process";

export function run(cmd, args = [], options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    input: options.input,
  });

  if (options.check !== false && result.status !== 0) {
    const command = [cmd, ...args].join(" ");
    const stderr = result.stderr ? `\n${result.stderr}` : "";
    const stdout = result.stdout ? `\n${result.stdout}` : "";
    throw new Error(`Command failed (${result.status}): ${command}${stdout}${stderr}`);
  }

  return {
    status: result.status ?? 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function git(repoDir, args, options = {}) {
  return run("git", args, { ...options, cwd: repoDir });
}
