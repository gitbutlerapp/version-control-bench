export const TASK_BRANCH = "notify-retry";

export const BASE_FILES = {
  "README.md": `# Notify Service

Small TypeScript service used by the update-dirty-branch benchmark pilot.
`,

  "src/notify.ts": `export type Channel = "email" | "sms" | "push";

export const activeChannels: Channel[] = ["email"];

export function notifyTargets(user: string): string[] {
  return activeChannels.map((channel) => \`\${channel}:\${user}\`);
}
`,

  "src/config.ts": `export interface NotifyConfig {
  region: string;
  retryLimit: number;
  batchSize: number;
}

export const config: NotifyConfig = {
  region: "local",
  retryLimit: 2,
  batchSize: 20,
};
`,
};

// Feature branch work, based on the old main tip.

export const FEATURE1_FILES = {
  ...BASE_FILES,

  "src/notify.ts": BASE_FILES["src/notify.ts"].replace(
    `export const activeChannels: Channel[] = ["email"];`,
    `export const activeChannels: Channel[] = ["email", "sms"];`,
  ),
};

export const FEATURE2_FILES = {
  ...FEATURE1_FILES,

  "src/config.ts": BASE_FILES["src/config.ts"].replace("retryLimit: 2,", "retryLimit: 4,"),
};

// Upstream advance on main, also based on the old main tip. The push-channel
// commit touches the same activeChannels line as the first feature commit,
// and the retry-limit commit touches the same config line as the second
// feature commit — two conflicts, in two different commits and files.

export const UPSTREAM1_FILES = {
  ...BASE_FILES,

  "src/notify.ts": BASE_FILES["src/notify.ts"].replace(
    `export const activeChannels: Channel[] = ["email"];`,
    `export const activeChannels: Channel[] = ["email", "push"];`,
  ),
};

export const UPSTREAM2_FILES = {
  ...UPSTREAM1_FILES,

  "src/config.ts": BASE_FILES["src/config.ts"].replace("retryLimit: 2,", "retryLimit: 5,"),
};

// Dirty worktree state on top of the feature branch tree. The README edit
// touches a file no commit changes, so it must ride through the update
// untouched and uncommitted; conflicts live only inside commits.

export const DIRTY_README = `${BASE_FILES["README.md"]}
Retry tuning notes are being collected on this branch before release.
`;

export const DIRTY_FILES = {
  ...FEATURE2_FILES,

  "README.md": DIRTY_README,

  "notes/rollout-checklist.md": `# Rollout Checklist

- Verify relay quotas before enabling the higher retry limit.
- Keep this checklist out of version control.
`,
};

// The committed conflict must resolve to both channels surviving; either
// ordering is accepted.

export const NOTIFY_COMBINED_VARIANTS = [
  BASE_FILES["src/notify.ts"].replace(
    `export const activeChannels: Channel[] = ["email"];`,
    `export const activeChannels: Channel[] = ["email", "sms", "push"];`,
  ),
  BASE_FILES["src/notify.ts"].replace(
    `export const activeChannels: Channel[] = ["email"];`,
    `export const activeChannels: Channel[] = ["email", "push", "sms"];`,
  ),
];

// Expected branch tree after the update, minus src/notify.ts which is
// variant-checked separately. The branch's tuned retry limit wins over the
// upstream bump per the task instruction.

export const EXPECTED_BRANCH_TREE = {
  "README.md": BASE_FILES["README.md"],
  "src/config.ts": FEATURE2_FILES["src/config.ts"],
};

// Expected worktree contents that must stay uncommitted after the update.

export const EXPECTED_DIRTY_WORKTREE = {
  "README.md": DIRTY_README,
  "notes/rollout-checklist.md": DIRTY_FILES["notes/rollout-checklist.md"],
};

export const UPSTREAM_COMMIT_STATES = [
  { subject: "Add push channel", files: UPSTREAM1_FILES },
  { subject: "Raise retry limit", files: UPSTREAM2_FILES },
];

export const FEATURE_COMMIT_STATES = [
  { subject: "Add sms channel", files: FEATURE1_FILES },
  { subject: "Tune retry budget", files: FEATURE2_FILES },
];

export const UPSTREAM_HOLD_REF = "refs/bench/upstream-main";

export const ALL_KNOWN_PATHS = [
  ...new Set([
    ...Object.keys(BASE_FILES),
    ...UPSTREAM_COMMIT_STATES.flatMap((state) => Object.keys(state.files)),
    ...FEATURE_COMMIT_STATES.flatMap((state) => Object.keys(state.files)),
    ...Object.keys(DIRTY_FILES),
  ]),
];
