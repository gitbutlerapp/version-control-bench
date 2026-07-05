// Page copy. Register: a benchmark report, declarative and precise, defined
// terms used consistently, accessible to a non-specialist. The benchmark is
// the subject; GitButler is one of three tools plus a single flat disclosure.

// Public benchmark repository. Each scenario id is also its task directory name.
export const REPO_URL = 'https://github.com/gitbutlerapp/version-control-bench';
export const taskDefUrl = (scenarioId: string) =>
  `${REPO_URL}/tree/main/tasks/${scenarioId}`;

// Homepage / docs for each measured tool, linked from the results-matrix headers.
export const TOOL_URL: Record<string, string> = {
  git: 'https://git-scm.com/',
  'jj+skill': 'https://www.jj-vcs.dev/latest/',
  'but+skill': 'https://docs.gitbutler.com/ai-agents/overview',
};

export const HERO = {
  title: 'A version-control benchmark for coding agents',
  intro: [
    'Which version-control tool should you give your coding agent? This benchmark fixes the agents — Claude Code and Codex — and compares three toolsets across five version-control operations: plain git, Jujutsu, and GitButler. It is the inverse of benchmarks that compare models on a fixed tool.',
    'On today’s frontier models all three are reliable — 239 of 240 runs passed — so the separator is speed, not correctness: GitButler ran about 60% faster than git with roughly 80% fewer commands, while Jujutsu was slower than git for both.',
  ],
};

// The results matrix: 5 tasks (rows) x 3 tools, each with pass, time, commands, KB.
export const RESULTS = {
  eyebrow: 'Results',
  title: 'Results matrix',
  lede: 'Each tool on each scenario, for the selected agent.',
  columns: {
    pass: 'Reliability: share of runs that produced the exact history the instruction asked for.',
    time: 'Speed: mean wall-clock time per run, setup excluded.',
    cmds: 'Version-control commands the agent ran per run. Fewer usually means less time and less output.',
    kb: 'Efficiency: kilobytes of version-control output the agent read back per run (skill reads excluded) — a token-cost proxy, comparable within one agent only.',
  },
};

export const SCENARIOS_INTRO = {
  title: 'Scenarios',
  lede: 'Each scenario is a pre-built Git repository plus a plain-English instruction. No code is written during a run — only the version-control operation is measured.',
};

export const METHOD = {
  title: 'Method',
  lede: 'GitButler builds and maintains this benchmark and is one of the three tools it measures — check rather than trust; the tasks, grader, harness, and per-run evidence are public. A hidden, deterministic grader scores the final Git state, so two different command sequences pass if they produce the same history. Every tool gets the same task and the same plain-English instruction, the tool’s name never appears in the prompt, and setup is excluded from timing.',
  facts: [
    {
      term: 'Identical instruction across tools',
      body: 'Each task is one prepared repository plus one plain-English instruction ("commit just the input-validation work on a new branch, leave the rest uncommitted"). The tool’s name never appears; the agent decides how to carry it out.',
    },
    {
      term: 'Deterministic grader',
      body: 'A hidden, scripted check that returns the same verdict for the same final state — no LLM judge. It inspects commit boundaries, branch topology, and what stayed uncommitted, and does not compare commands against a reference: two command sequences pass if they produce the same history.',
    },
    {
      term: 'Timing boundary',
      body: 'Fixture build, workspace prep, skill install, and placing the uncommitted changes all happen before timing starts. The figures cover only the agent’s work on the task.',
    },
    {
      term: 'Git write restriction',
      body: 'In GitButler and Jujutsu runs, raw git write commands are blocked, so the agent must use the tool under test. Git the tool calls internally is the tool’s own work, not the agent’s.',
    },
    {
      term: 'Jujutsu setup',
      body: 'jj 0.42.0, a colocated repository (jj and git on the same working copy), and the most-installed external jj skill, all in place before timing.',
    },
    {
      term: 'Repeated runs per cell',
      body: 'Each agent–tool–scenario cell runs several times (k, shown above); the figures are means over those runs, with a Wilson 95% interval on each pass rate.',
    },
    {
      term: 'Uncertainty',
      body: 'Runs of the same scenario are correlated, so cross-scenario claims pair per-scenario deltas against the same agent’s git runs; the "statistical read" under the matrix shows them. With five scenarios those intervals are wide — directions are consistent, but effect sizes hold for these operations only.',
    },
  ],
};

// Known limits, stated so they are priced in rather than discovered. Scope
// critiques are welcome; honesty critiques should find nothing to add.
export const LIMITS = {
  title: 'Limitations',
  lede: 'Every benchmark measures a slice. These are the known limits of this one.',
  items: [
    {
      term: 'Built by a contestant',
      body: 'GitButler funds and maintains this benchmark and is one of the three tools measured. Treat every design choice as potentially biased — and check: the tasks, grader, harness, and per-run evidence are public, and any cell can be re-run.',
    },
    {
      term: 'Five scenarios',
      body: 'Five operations is a small sample. Pass intervals are wide and most cross-scenario effects don’t reach significance, so claims here are about these operations, not version control in general. The task set is growing.',
    },
    {
      term: 'Skill asymmetry',
      body: 'GitButler runs with its first-party skill; Jujutsu with the most-installed community skill (pinned and hash-verified); git runs bare, as agents already know it best. A better skill for any arm would move its numbers — improvements are welcome as pull requests.',
    },
    {
      term: 'Training data favors git',
      body: 'Models have seen far more git than Jujutsu or GitButler. The deck is stacked toward the baseline: challenger wins are stronger than they look, and challenger losses are partly unfamiliarity.',
    },
    {
      term: 'Synthetic fixtures',
      body: 'Scenarios are small, script-built TypeScript repositories — deterministic and contamination-resistant, but smaller and cleaner than real ones. Real-repository scenarios are planned.',
    },
    {
      term: 'Both agents are at the ceiling',
      body: 'With 239 of 240 runs passing, the benchmark now separates the tools almost entirely on speed and efficiency, not reliability — better models closed the reliability differences it once showed. Harder scenarios are the priority before the reliability comparison says anything about frontier agents.',
    },
    {
      term: 'Versions, not verdicts',
      body: 'Each result belongs to a specific agent version, model, tool build, and skill revision (all in provenance). Newer models can change the picture; the benchmark is re-run as they ship.',
    },
    {
      term: 'What a pass does not measure',
      body: 'The grader checks the final Git state only — not commit-message quality, human ergonomics, merge and remote workflows, or long-horizon multi-branch work.',
    },
  ],
};

export const LEDGER = {
  title: 'Failed runs',
  // lede is derived from the data in the component so it never goes stale.
  emptyLede: 'No runs failed the grader in this batch.',
};

export const AGENT_NOTE =
  'Both agents are run to check whether the tool effect holds across them. This is not a Claude-versus-Codex comparison.';

// Section kicker labels (rendered uppercase mono above each heading).
export const EYEBROWS = {
  scenarios: 'Scenarios',
  method: 'Method',
  proof: 'Results',
  failures: 'Failures',
  limitations: 'Limitations',
  provenance: 'About',
};

// Every full-matrix batch, newest first. Links go to the checked-in writeups
// so the page shows the benchmark is versioned and re-run, not a one-shot.
const resultDocUrl = (name: string) => `${REPO_URL}/blob/main/docs/results/${name}`;
export const HISTORY = {
  title: 'Results history',
  lede: 'Every full-matrix batch is written up and checked in; the page above always shows the latest.',
  entries: [
    { date: '2026-07-05', scope: 'k=8 · Opus 4.8 · GPT-5.5', passed: '239/240', url: resultDocUrl('full-k8-2026-07-05.md'), current: true },
    { date: '2026-07-03', scope: 'k=7 · Opus 4.1 · GPT-5.5', passed: '193/210', url: resultDocUrl('full-k7-2026-07-03.md') },
    { date: '2026-07-01', scope: 'k=5 · 3 tools · 2 agents', passed: '137/150', url: resultDocUrl('full-k5-2026-07-01.md') },
    { date: '2026-06-29', scope: 'k=5 · 3 tools · 2 agents', passed: '142/150', url: resultDocUrl('full-k5-2026-06-29.md') },
    { date: '2026-06-28', scope: 'k=5 · git + GitButler', passed: '100/100', url: resultDocUrl('full-k5-2026-06-28.md') },
    { date: '2026-06-27', scope: 'k=5 · git + GitButler', passed: '99/100', url: resultDocUrl('full-k5-2026-06-27.md') },
    { date: '2026-06-26', scope: 'k=5 · git + GitButler', passed: '95/100', url: resultDocUrl('full-k5-2026-06-26.md') },
    { date: '2026-06-22', scope: 'k=3 · git + GitButler', passed: '60/60', url: resultDocUrl('full-k3-2026-06-22.md') },
  ],
};

// Neighbors in the benchmark landscape. Named generously: they answer
// different questions, and saying how earns the comparison back.
export const RELATED = {
  title: 'How this relates to other benchmarks',
  lede: 'Most benchmarks in this space fix the tool and compare models. This one fixes the agents and compares the tools — the question a team faces once the agent is already chosen.',
  items: [
    {
      name: 'jj-benchmark',
      by: 'TabbyML',
      url: 'https://github.com/TabbyML/jj-benchmark',
      read: 'Fixes one tool (Jujutsu) and compares models on operating it.',
    },
    {
      name: 'GitBench',
      by: 'GitKraken',
      url: 'https://gitbench.gitkraken.com/',
      read: 'Single-turn git question answering across models; no multi-turn tool use.',
    },
    {
      name: 'GitGoodBench',
      by: 'JetBrains Research',
      url: 'https://github.com/JetBrains-Research/git-good-bench',
      read: 'Scores models on git tasks mined from real repositories.',
    },
    {
      name: 'Terminal-Bench',
      by: 'Stanford / Laude Institute',
      url: 'https://www.tbench.ai/',
      read: 'General terminal agents across many task types; a handful touch version control.',
    },
  ],
};

// The k=7 batch predates per-run model capture for Claude; the model is known
// from Claude Code session metadata (see docs/results/full-k7-2026-07-03.md).
// Once a batch with per-run capture lands, observed_model populates and this
// fallback goes unused.
export const MODEL_FALLBACK: Record<string, string> = {
  claude: 'claude-opus-4-1-20250805 (from session metadata)',
};

// Small inline strings used across components.
export const MICRO = {
  promptLabel: 'Instruction given to the agent',
  lowerIsBetter: 'lower is better',
  reproduceTitle: 'About this benchmark',
  reproduceLede:
    'The numbers above are derived from the latest full-matrix aggregate. The source snapshot and commands that produced them are listed below.',
  footerNote:
    'Maintained by GitButler, one of the three tools measured; the grader is deterministic and the data is public.',
};
