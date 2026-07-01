// Page copy. Voice: a neutral benchmark spec — third person, descriptive, no
// first-person narrator and no selling. The benchmark describes what it tests,
// how it grades, and what the runs produced. GitButler's involvement is a flat
// disclosure, not a frame.

export const HERO = {
  title: 'A version-control benchmark for coding agents',
  intro: [
    'This benchmark measures how coding agents handle common version-control work — pulling one change out of a messy worktree, splitting a commit, reordering history. Two agents, Claude Code and Codex, run five such tasks with three tools: git, Jujutsu, and GitButler.',
    'Every run is graded by a deterministic checker on the resulting Git state, not on the commands used to get there. The tasks, the grading, and the per-run data are all below.',
  ],
};

export const SCENARIOS_INTRO = {
  title: 'The five tasks',
  lede: 'Each task starts from a realistic repository state and a plain-English instruction. The file changes already exist; the job is to produce the Git history a reviewer would expect — the right commit boundaries, branch shape, and leftover changes. Nothing about the code itself is graded.',
};

export const METHOD = {
  title: 'How it is measured',
  lede: 'Every tool gets the same task and the same plain-English instruction; the tool name never appears in the prompt. Correctness is decided by a deterministic grader on the final Git state, and setup is excluded from timing.',
  disclosure:
    'This benchmark is built and maintained by GitButler, one of the three tools measured. Correctness is determined by the grader, not by GitButler. The task definitions, the grader, and the per-run data are public.',
  facts: [
    {
      term: 'Same task, same words, every tool',
      body: 'Each task ships as one fixture with one plain-English instruction ("commit just the input validation work on a new branch, leave the rest uncommitted"). The tool\'s name never appears in the prompt. The agent decides how to carry it out.',
    },
    {
      term: 'Deterministic grader',
      body: 'Correctness is checked by a hidden, deterministic grader that inspects the resulting Git state — commit boundaries, branch topology, what stayed uncommitted. It is not an LLM judge, and it does not check whether the agent ran some "correct" sequence. Two different command sequences pass if they produce the same history.',
    },
    {
      term: 'Setup is excluded from timing',
      body: "Building the fixture, preparing the workspace, installing each tool's skill, and dirtying the worktree all happen before the clock starts. Measured time and command counts cover only the agent's work on the task.",
    },
    {
      term: 'Raw git writes are blocked',
      body: 'In the GitButler and Jujutsu arms, raw git writes are blocked, so the agent has to use the tool under test. When the tool calls git internally, that is the tool\'s own work and does not count against the agent.',
    },
    {
      term: 'Jujutsu setup',
      body: 'jj 0.42.0, a properly colocated repo, and the most-used external jj agent skill, installed before the clock starts.',
    },
    {
      term: 'Five runs per cell (k=5)',
      body: 'Every agent-tool-task cell ran five times. The numbers on this page are means over those repeats, not a single run.',
    },
  ],
};

export const LIMITS = {
  title: 'What this does not prove',
  items: [
    {
      term: 'Not a coding benchmark',
      body: 'Every task is version-control cleanup with the code already written. It says nothing about whether an agent writes good code.',
    },
    {
      term: 'Five tasks, not the whole job',
      body: 'These are common situations, but they are a sample. Many version-control tasks are not covered here, and real branches vary more than these fixtures.',
    },
    {
      term: 'A snapshot in time',
      body: 'Specific versions of three tools, two agents, and three skills on one date. Tools and agents change; this is not a permanent ranking.',
    },
    {
      term: 'KB is an estimate',
      body: 'The warm byte count subtracts visible skill reads to approximate task-only output. It is a proxy, not a token meter, and only comparable within one agent.',
    },
    {
      term: 'The agents are not ranked',
      body: 'Claude and Codex both appear to check whether the tool effect holds across agents. They are not ranked against each other.',
    },
  ],
};

export const SCORECARD = {
  title: 'Tool by tool',
  lede: 'Each tool on each task, graded the same way. Pick an agent and a metric; pass rate sits to the left of every bar.',
  gateNote:
    'A run that produces the wrong history fails, regardless of how fast it finished. Read pass rate before speed.',
};

export const MECHANISM = {
  title: 'Command breakdown',
  lede: 'Most version-control commands an agent runs are inspections — status, log, diff — to read the current state before each edit. The split below is inspect versus mutate commands per tool.',
  approxNote:
    'Approximate split — inspect and mutate counts are classified per command and do not always sum to the total.',
};

export const COST = {
  title: 'Output size',
  lede: 'Each tool produces a different amount of version-control output for the agent to read back — a rough proxy for tokens spent.',
  warning:
    'Claude and Codex record their transcripts in different formats, so these kilobyte numbers are not comparable between agents. Compare tools within one agent only, never across agents.',
  note: 'KB is a token-cost proxy, not a token counter. The warm figure subtracts the bytes spent reading the tool skill, so it estimates task-only output. Cold is the raw total.',
};

export const LEDGER = {
  title: 'Every run that failed',
  lede: 'Thirteen of 150 runs failed the grader. Every failure was Claude; most were Jujutsu, with two plain git misses and one GitButler miss.',
  proportionality:
    'Jujutsu had the widest correctness problem: Claude split-commit failed 5/5, multi-amend failed 3/5, and reorder failed 2/5. GitButler had one Claude selective-commit partition miss. Plain git had two Claude misses.',
  defs: [
    { term: 'GRAPH_WRONG', read: 'Right file contents, wrong commit order or topology.' },
    {
      term: 'CONTENT_WRONG',
      read: 'Wrong final file contents, or leftovers committed that should have stayed out.',
    },
    {
      term: 'DIRTY_STATE_WRONG',
      read: 'The final dirty worktree state did not match the expected leftovers.',
    },
    {
      term: 'PARTITION_WRONG',
      read: 'The run committed or left behind the wrong subset of changes.',
    },
  ],
};

export const METRIC_LABELS = {
  time: { label: 'Time', sub: 'mean wall-clock per run' },
  ops: { label: 'VC commands', sub: 'version-control commands the agent ran' },
};

export const AGENT_NOTE =
  'Both agents are shown to check whether the tool effect holds across them. This is not a Claude-versus-Codex comparison.';

// Section kicker labels (rendered uppercase mono above each heading).
export const EYEBROWS = {
  scenarios: 'Scenarios',
  method: 'Method',
  proof: 'Results',
  mechanism: 'Commands',
  cost: 'Output',
  failures: 'Failures',
  provenance: 'About',
};

// Small inline strings used across components.
export const MICRO = {
  promptLabel: 'The instruction the agent saw',
  lowerIsBetter: 'lower is better',
  kbCalloutLabel: 'Comparable within one agent only',
  reproduceTitle: 'About this benchmark',
  reproduceLede:
    'The numbers above are derived from the latest full-matrix aggregate. Below is exactly what produced them.',
  footerNote:
    'Maintained by GitButler, one of the three tools measured. The grader is deterministic and the data is public.',
};
