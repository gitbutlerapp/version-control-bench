#!/usr/bin/env node
import path from "node:path";
import { parseArgs } from "./lib/args.mjs";
import {
  EXPECTED_BRANCH_TREE,
  EXPECTED_DIRTY_WORKTREE,
  FEATURE2_FILES,
  NOTIFY_COMBINED_VARIANTS,
  UPSTREAM2_FILES,
} from "./lib/pilot6-content.mjs";
import {
  commitPatch,
  fileText,
  gitMaybe,
  gitShow,
  gitText,
  minefieldReport,
  noOperationInProgress,
  noStashLeftBehind,
  patchChangedText,
  readJson,
  sameArray,
  weightedScore,
  workingCopyDiff,
} from "./lib/verifier.mjs";

const MINEFIELD_CHECKS = [
  "main_matches_upstream_tip",
  "no_operation_in_progress",
  "no_unmerged_index_entries",
  "no_conflict_markers",
  "dirty_readme_preserved",
  "dirty_readme_uncommitted",
  "leftover_note_preserved",
  "leftover_note_untracked",
  "no_unexpected_tracked_changes",
  "no_stash_left_behind",
];

function classify(checks) {
  if (!checks.git_repo || !checks.main_exists) {
    return "ENV_FAILURE";
  }
  if (!checks.main_has_expected_commit_count || !checks.main_matches_upstream_tip) {
    return "PROTECTED_REF_MOVED";
  }
  if (!checks.no_operation_in_progress || !checks.no_unmerged_index_entries || !checks.no_conflict_markers) {
    return "CONFLICT_UNRESOLVED";
  }
  if (
    !checks.task_branch_exists
    || !checks.branch_based_on_main
    || !checks.branch_has_expected_commit_count
    || !checks.commit_subjects_preserved
    || !checks.no_merge_commits
  ) {
    return "GRAPH_WRONG";
  }
  if (
    !checks.committed_conflict_combined
    || !checks.config_conflict_kept_branch_value
    || !checks.branch_tree_matches_target
    || !checks.sms_channel_in_first_commit
    || !checks.retry_budget_in_second_commit
  ) {
    return "CONTENT_WRONG";
  }
  if (
    !checks.dirty_readme_preserved
    || !checks.dirty_readme_uncommitted
    || !checks.leftover_note_preserved
    || !checks.leftover_note_untracked
    || !checks.no_unexpected_tracked_changes
    || !checks.no_stash_left_behind
  ) {
    return "DIRTY_STATE_WRONG";
  }
  return null;
}

function score(checks) {
  const weights = {
    git_repo: 4,
    main_exists: 4,
    main_has_expected_commit_count: 5,
    main_matches_upstream_tip: 5,
    no_operation_in_progress: 5,
    no_unmerged_index_entries: 5,
    no_conflict_markers: 5,
    task_branch_exists: 4,
    branch_based_on_main: 10,
    branch_has_expected_commit_count: 6,
    commit_subjects_preserved: 6,
    no_merge_commits: 5,
    committed_conflict_combined: 8,
    config_conflict_kept_branch_value: 8,
    sms_channel_in_first_commit: 2,
    retry_budget_in_second_commit: 2,
    branch_tree_matches_target: 4,
    dirty_readme_preserved: 8,
    dirty_readme_uncommitted: 4,
    leftover_note_preserved: 4,
    leftover_note_untracked: 2,
    no_unexpected_tracked_changes: 2,
    no_stash_left_behind: 2,
  };

  return weightedScore(checks, weights);
}

const args = parseArgs(process.argv.slice(2));
const repoDir = path.resolve(args.get("repo") ?? ".");
const taskDir = path.resolve(args.get("task") ?? "tasks/pilot-6-update-dirty-branch");
const oracle = readJson(path.join(taskDir, "oracle/oracle.json"));

const checks = {};
const details = {};

checks.git_repo = gitMaybe(repoDir, ["rev-parse", "--git-dir"]) !== null;
checks.main_exists = gitMaybe(repoDir, ["rev-parse", "--verify", "refs/heads/main"]) !== null;

// main must still be exactly the upstream tip: three commits, upstream content,
// and no feature files leaked onto it.
checks.main_has_expected_commit_count = checks.main_exists && gitText(repoDir, ["rev-list", "--count", "main"]) === "3";
checks.main_matches_upstream_tip = checks.main_exists
  && gitShow(repoDir, "main", "src/notify.ts") === UPSTREAM2_FILES["src/notify.ts"]
  && gitShow(repoDir, "main", "src/config.ts") === UPSTREAM2_FILES["src/config.ts"];

checks.no_operation_in_progress = noOperationInProgress(repoDir);
checks.no_unmerged_index_entries = gitMaybe(repoDir, ["ls-files", "-u"]) === "";

const markerFiles = ["src/notify.ts", "src/config.ts", "README.md"];
const markerResults = markerFiles.map((filePath) => ({
  path: filePath,
  clean: !(fileText(repoDir, filePath) ?? "").includes("<<<<<<<"),
}));
details.conflict_marker_results = markerResults;
checks.no_conflict_markers = markerResults.every((result) => result.clean);

const branch = oracle.task_branch;
details.task_branch = branch;
checks.task_branch_exists = gitMaybe(repoDir, ["rev-parse", "--verify", `refs/heads/${branch}`]) !== null;
checks.branch_based_on_main = checks.task_branch_exists
  && gitMaybe(repoDir, ["merge-base", "--is-ancestor", "main", branch]) !== null;

let commits = [];
let commitSubjects = [];
if (checks.task_branch_exists && checks.branch_based_on_main) {
  commits = gitText(repoDir, ["rev-list", "--reverse", `main..${branch}`]).split("\n").filter(Boolean);
  commitSubjects = commits.map((hash) => gitText(repoDir, ["log", "-1", "--format=%s", hash]));
}
details.commit_subjects = commitSubjects;
checks.branch_has_expected_commit_count = commits.length === oracle.commit_subjects.length;
checks.commit_subjects_preserved = sameArray(commitSubjects, oracle.commit_subjects);
checks.no_merge_commits = checks.task_branch_exists
  && gitMaybe(repoDir, ["rev-list", "--merges", `main..${branch}`]) === "";

const branchNotify = checks.task_branch_exists ? gitShow(repoDir, branch, "src/notify.ts") : null;
details.branch_notify_matches_variant = NOTIFY_COMBINED_VARIANTS.indexOf(branchNotify);
checks.committed_conflict_combined = NOTIFY_COMBINED_VARIANTS.includes(branchNotify);

const firstCommitPatch = commits.length > 0 ? patchChangedText(commitPatch(repoDir, commits[0])) : "";
checks.sms_channel_in_first_commit = firstCommitPatch.includes('"sms"');

const branchConfig = checks.task_branch_exists ? gitShow(repoDir, branch, "src/config.ts") : null;
checks.config_conflict_kept_branch_value = branchConfig === FEATURE2_FILES["src/config.ts"];

const secondCommitPatch = commits.length > 1 ? patchChangedText(commitPatch(repoDir, commits[1])) : "";
checks.retry_budget_in_second_commit = secondCommitPatch.includes("retryLimit: 4,");

const treeResults = Object.entries(EXPECTED_BRANCH_TREE).map(([filePath, content]) => ({
  path: filePath,
  matches: gitShow(repoDir, branch, filePath) === content,
}));
details.branch_tree_file_results = treeResults;
const actualTreePaths = checks.task_branch_exists
  ? gitText(repoDir, ["ls-tree", "-r", "--name-only", branch]).split("\n").filter(Boolean).sort()
  : [];
details.branch_tree_paths = actualTreePaths;
const expectedTreePaths = [...Object.keys(EXPECTED_BRANCH_TREE), "src/notify.ts"].sort();
checks.branch_tree_matches_target = treeResults.every((result) => result.matches)
  && sameArray(actualTreePaths, expectedTreePaths);

checks.dirty_readme_preserved = fileText(repoDir, "README.md") === EXPECTED_DIRTY_WORKTREE["README.md"];
const uncommittedDiff = workingCopyDiff(repoDir);
details.uncommitted_diff = uncommittedDiff;
checks.dirty_readme_uncommitted = uncommittedDiff.includes("Retry tuning notes are being collected")
  && gitShow(repoDir, branch, "README.md") !== EXPECTED_DIRTY_WORKTREE["README.md"];

checks.leftover_note_preserved = fileText(repoDir, "notes/rollout-checklist.md") === EXPECTED_DIRTY_WORKTREE["notes/rollout-checklist.md"];
checks.leftover_note_untracked = gitShow(repoDir, branch, "notes/rollout-checklist.md") === null;

const statusLines = (gitMaybe(repoDir, ["status", "--porcelain"]) ?? "")
  .split("\n")
  .filter(Boolean)
  .filter((line) => !line.slice(3).startsWith(".jj"));
details.status_porcelain = statusLines;
// Jujutsu auto-tracks new files in its working-copy commit, so the leftover
// note may legitimately show as an added tracked change rather than
// untracked; leftover_note_untracked already guarantees it is not part of
// the branch itself.
const allowedDirtyPaths = new Set(["README.md", "notes/rollout-checklist.md"]);
const trackedChanges = statusLines.filter((line) => !line.startsWith("??")).map((line) => line.slice(3));
const untrackedSourcePaths = statusLines
  .filter((line) => line.startsWith("??"))
  .map((line) => line.slice(3))
  .filter((entry) => entry.startsWith("src/"));
checks.no_unexpected_tracked_changes = trackedChanges.every((entry) => allowedDirtyPaths.has(entry))
  && untrackedSourcePaths.length === 0;

checks.no_stash_left_behind = noStashLeftBehind(repoDir);

const failureClass = classify(checks);
const result = {
  passed: failureClass === null,
  failure_class: failureClass,
  score: score(checks),
  checks,
  minefields: minefieldReport(checks, MINEFIELD_CHECKS),
  details,
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.passed ? 0 : 1);
