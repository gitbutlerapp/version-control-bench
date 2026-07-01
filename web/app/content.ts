// Page copy. Voice: a benchmark/methods report — measured and precise, a light
// academic register kept accessible to a non-specialist. The benchmark is the
// subject; GitButler is one of three tools plus a single flat disclosure.

export const HERO = {
  title: 'A version-control benchmark for coding agents',
  intro: [
    'Nearly all software work touches version control: recording changes, then shaping them into a history a reviewer can follow. Increasingly the one doing that work is a coding agent rather than a person, and as agents take over more of it, the tool they are handed starts to decide whether the job actually gets done. This benchmark measures how well two agents (Claude Code and Codex) do five realistic version-control tasks with each of three tools.',
    'For each, the question is how reliably, quickly, and efficiently an agent reaches the intended result with a given tool — judged on the final Git history, not the commands used to get there.',
  ],
};

// The results matrix: 5 tasks (rows) x 3 tools, each with pass, time, commands, KB.
export const RESULTS = {
  eyebrow: 'Results',
  title: 'Every tool on every task',
  lede: 'Time, commands, and version-control output for each tool on each task, for the selected agent. Reliability comes first: a run that produces the wrong history fails however fast it was, so pass rate leads each tool, and cells where the tool did not pass all five runs are muted.',
  columns: {
    pass: 'Reliability — the share of the five runs that produced the exact history the task asked for.',
    time: 'Speed — mean wall-clock time per run, with setup excluded.',
    cmds: 'Version-control commands the agent ran. Not a headline axis; it explains why a tool is faster or leaner.',
    kb: 'Efficiency — version-control output the agent read back, a proxy for token cost. Comparable within one agent only.',
  },
};

export const SCENARIOS_INTRO = {
  title: 'The five scenarios',
  lede: 'Each scenario is a pre-built Git repository fixed at a specific starting state — a real commit history plus uncommitted changes in the working tree — together with a plain-English instruction describing the intended result. No code is generated during a run; the file changes already exist. Only the version-control operation is measured: moving the repository from that starting state to the Git history the instruction calls for.',
};

export const METHOD = {
  title: 'How it is measured',
  lede: 'The grader scores the outcome, not the commands: a hidden, deterministic check on the final Git state, where two entirely different command sequences pass if they produce the same history. Every tool gets the same task and the same plain-English instruction, the tool name never appears in the prompt, and setup is excluded from timing.',
  disclosure:
    'This benchmark is built and maintained by GitButler, one of the three tools measured; correctness is determined by the grader, not by GitButler, and the task definitions, the grader, and the per-run data are all public.',
  facts: [
    {
      term: 'Same task, same words, every tool',
      body: 'Each task ships as one fixture with one plain-English instruction ("commit just the input validation work on a new branch, leave the rest uncommitted"). The tool\'s name never appears in the prompt. The agent decides how to carry it out.',
    },
    {
      term: 'Deterministic grader',
      body: 'Correctness is checked by a hidden, deterministic grader that inspects the resulting Git state: commit boundaries, branch topology, what stayed uncommitted. It is not an LLM judge, and it does not check whether the agent ran some "correct" sequence. Two different command sequences pass if they produce the same history.',
    },
    {
      term: 'Setup is excluded from timing',
      body: "Building the fixture, preparing the workspace, installing each tool's skill, and dirtying the worktree all happen before the clock starts. The measured figures cover only the agent's work on the task.",
    },
    {
      term: 'Raw git writes are blocked',
      body: "In the GitButler and Jujutsu arms, raw git writes are blocked, so the agent has to use the tool under test. When the tool calls git internally, that is the tool's own work and does not count against the agent.",
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
      body: 'Claude and Codex are both run to check whether the tool effect holds across agents. They are not ranked against each other.',
    },
  ],
};

export const SCORECARD = {
  title: 'Tool by tool',
  lede: 'Each tool on each task, graded the same way. Pick an agent and a metric; reliability comes first, so pass rate sits to the left of every bar, and speed and efficiency are read only among the runs that passed.',
  gateNote:
    'Reliability is the gate: a run that produces the wrong history fails, regardless of how fast it finished. Read pass rate before speed.',
};

export const MECHANISM = {
  title: 'Why one tool is faster: command volume',
  lede: 'Command count is not a headline axis; it is the mechanism behind speed and efficiency. A tool that needs fewer inspect and mutate commands tends to finish faster and emit less output. Most version-control commands an agent runs are inspections (status, log, diff) to read the current state before each edit; the split below is inspect versus mutate commands per tool.',
  approxNote:
    'Approximate split — inspect and mutate counts are classified per command and do not always sum to the total.',
};

export const COST = {
  title: 'Output size',
  lede: 'This is the backing measure for the efficiency axis: each tool produces a different amount of version-control output for the agent to read back, a proxy for the tokens spent getting to the answer.',
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
  'Both agents are run to check whether the tool effect holds across them. This is not a Claude-versus-Codex comparison.';

// Section kicker labels (rendered uppercase mono above each heading).
export const EYEBROWS = {
  scenarios: 'Scenarios',
  method: 'Method',
  proof: 'Results',
  mechanism: 'Why',
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
    'Maintained by GitButler, one of the three tools measured; the grader is deterministic and the data is public.',
};
