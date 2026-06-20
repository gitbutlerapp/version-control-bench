export const TASK_BRANCH = "amend-series";

export const MAIN_FILES = {
  "README.md": `# Lead Routing Service

Small TypeScript service used by the multi-amend benchmark pilot.
`,

  "package.json": `{
  "name": "lead-routing-service",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "node tests/lead.test.ts && node tests/handler.test.ts"
  },
  "dependencies": {},
  "devDependencies": {}
}
`,
};

export const COMMIT1_FILES = {
  ...MAIN_FILES,

  "README.md": `# Lead Routing Service

Small TypeScript service used by the multi-amend benchmark pilot.

## Validation

- Requires a contact name and an email address before a lead can be accepted.
- Normalizes email casing before creating identifiers.
`,

  "src/lead.ts": `export interface LeadPayload {
  name: string;
  email: string;
  message?: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hasContactName(payload: LeadPayload): boolean {
  return payload.name.trim().length > 0;
}

export function hasEmail(payload: LeadPayload): boolean {
  return normalizeEmail(payload.email).length > 0;
}

export function isValidLead(payload: LeadPayload): boolean {
  return hasContactName(payload) && hasEmail(payload);
}
`,

  "tests/lead.test.ts": `import { isValidLead, normalizeEmail } from "../src/lead";

export function testNormalizeEmail(): void {
  const email = normalizeEmail(" ADA@EXAMPLE.COM ");

  if (email !== "ada@example.com") {
    throw new Error(\`unexpected email: \${email}\`);
  }
}

export function testIsValidLeadRequiresName(): void {
  const valid = isValidLead({ name: "", email: "ada@example.com" });

  if (valid) {
    throw new Error("missing name should be rejected");
  }
}

export function testIsValidLeadRequiresEmail(): void {
  const valid = isValidLead({ name: "Ada", email: "" });

  if (valid) {
    throw new Error("missing email should be rejected");
  }
}
`,
};

export const COMMIT2_FILES = {
  ...COMMIT1_FILES,

  "src/config.ts": `export interface ServiceConfig {
  region: string;
  defaultSource: string;
  retryLimit: number;
}

export const config: ServiceConfig = {
  region: "local",
  defaultSource: "web",
  retryLimit: 2,
};
`,
};

export const COMMIT3_FILES = {
  ...COMMIT2_FILES,

  "src/lead.ts": `export interface LeadPayload {
  name: string;
  email: string;
  message?: string;
}

export type ScoreBand = "cold" | "warm" | "hot";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hasContactName(payload: LeadPayload): boolean {
  return payload.name.trim().length > 0;
}

export function hasEmail(payload: LeadPayload): boolean {
  return normalizeEmail(payload.email).length > 0;
}

export function isValidLead(payload: LeadPayload): boolean {
  return hasContactName(payload) && hasEmail(payload);
}

export function scoreLead(payload: LeadPayload): number {
  const email = normalizeEmail(payload.email);
  let score = 10;

  if (email.endsWith("@example.com")) {
    score += 5;
  }

  if (payload.message && payload.message.length > 80) {
    score += 10;
  }

  return Math.min(score, 100);
}

export function scoreBand(score: number): ScoreBand {
  if (score >= 70) return "hot";
  if (score >= 30) return "warm";
  return "cold";
}
`,

  "tests/lead.test.ts": `import { isValidLead, normalizeEmail, scoreBand, scoreLead } from "../src/lead";

export function testNormalizeEmail(): void {
  const email = normalizeEmail(" ADA@EXAMPLE.COM ");

  if (email !== "ada@example.com") {
    throw new Error(\`unexpected email: \${email}\`);
  }
}

export function testIsValidLeadRequiresName(): void {
  const valid = isValidLead({ name: "", email: "ada@example.com" });

  if (valid) {
    throw new Error("missing name should be rejected");
  }
}

export function testIsValidLeadRequiresEmail(): void {
  const valid = isValidLead({ name: "Ada", email: "" });

  if (valid) {
    throw new Error("missing email should be rejected");
  }
}

export function testScoreLeadRewardsDetailedMessage(): void {
  const score = scoreLead({
    name: "Ada",
    email: "ada@example.com",
    message: "We are evaluating the product for a larger rollout across the sales team.",
  });

  if (score <= 10) {
    throw new Error(\`score was not increased: \${score}\`);
  }
}

export function testScoreBand(): void {
  if (scoreBand(75) !== "hot") {
    throw new Error("expected hot score band");
  }
}
`,
};

export const COMMIT4_FILES = {
  ...COMMIT3_FILES,

  "src/handler.ts": `import { config } from "./config";
import { isValidLead, LeadPayload, normalizeEmail, scoreBand, scoreLead } from "./lead";

export interface LeadResponse {
  accepted: boolean;
  id: string | null;
  score: number;
  band: string;
  source: string;
}

export function handleLead(payload: LeadPayload): LeadResponse {
  if (!isValidLead(payload)) {
    return {
      accepted: false,
      id: null,
      score: 0,
      band: "cold",
      source: config.defaultSource,
    };
  }

  const email = normalizeEmail(payload.email);
  const score = scoreLead(payload);

  return {
    accepted: true,
    id: \`\${payload.name}:\${email}\`,
    score,
    band: scoreBand(score),
    source: \`\${config.region}:\${config.defaultSource}\`,
  };
}
`,

  "tests/handler.test.ts": `import { handleLead } from "../src/handler";

export function testHandleLeadAcceptsValidPayload(): void {
  const result = handleLead({ name: "Ada", email: "ada@example.com" });

  if (!result.accepted || result.id !== "Ada:ada@example.com") {
    throw new Error("valid payload should be accepted");
  }
}
`,
};

export const COMMIT5_FILES = {
  ...COMMIT4_FILES,

  "README.md": `# Lead Routing Service

Small TypeScript service used by the multi-amend benchmark pilot.

## Validation

- Requires a contact name and an email address before a lead can be accepted.
- Normalizes email casing before creating identifiers.

## Scoring

- Assigns a score and score band to accepted leads.
- Uses the configured source when creating handler responses.

## Response Behavior

- Accepted responses include a lead id, score, band, and source.
- Rejected responses keep the id empty.
`,

  "docs/response.md": `# Response Behavior

Accepted leads return an id, score, band, and source.
Rejected leads return an empty id and a cold score band.
`,
};

export const TARGET_FILES = {
  ...COMMIT5_FILES,

  "README.md": `# Lead Routing Service

Small TypeScript service used by the multi-amend benchmark pilot.

## Validation

- Requires a contact name and a likely email address before a lead can be accepted.
- Normalizes email casing before creating identifiers.

## Scoring

- Assigns a score and score band to accepted leads.
- Uses the configured source when creating handler responses.

## Response Behavior

- Accepted responses include a lead id, score, band, and source.
- Rejected responses keep the id empty.
- Rejected responses include a reason that can be shown to operators.
`,

  "src/lead.ts": `export interface LeadPayload {
  name: string;
  email: string;
  message?: string;
}

export type ScoreBand = "cold" | "warm" | "hot";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hasContactName(payload: LeadPayload): boolean {
  return payload.name.trim().length > 0;
}

export function hasEmail(payload: LeadPayload): boolean {
  return normalizeEmail(payload.email).length > 0;
}

export function isLikelyEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.includes("@") && normalized.includes(".");
}

export function isValidLead(payload: LeadPayload): boolean {
  return hasContactName(payload) && hasEmail(payload) && isLikelyEmail(payload.email);
}

export function scoreLead(payload: LeadPayload): number {
  const email = normalizeEmail(payload.email);
  let score = 10;

  if (email.endsWith("@example.com")) {
    score += 5;
  }

  if (email.endsWith("@enterprise.example")) {
    score += 25;
  }

  if (payload.message && payload.message.length > 80) {
    score += 15;
  }

  return Math.min(score, 100);
}

export function scoreBand(score: number): ScoreBand {
  if (score >= 70) return "hot";
  if (score >= 30) return "warm";
  return "cold";
}
`,

  "tests/lead.test.ts": `import { isValidLead, normalizeEmail, scoreBand, scoreLead } from "../src/lead";

export function testNormalizeEmail(): void {
  const email = normalizeEmail(" ADA@EXAMPLE.COM ");

  if (email !== "ada@example.com") {
    throw new Error(\`unexpected email: \${email}\`);
  }
}

export function testIsValidLeadRequiresName(): void {
  const valid = isValidLead({ name: "", email: "ada@example.com" });

  if (valid) {
    throw new Error("missing name should be rejected");
  }
}

export function testIsValidLeadRejectsMalformedEmail(): void {
  const valid = isValidLead({ name: "Ada", email: "not-an-email" });

  if (valid) {
    throw new Error("malformed email should be rejected");
  }
}

export function testScoreLeadRewardsDetailedMessage(): void {
  const score = scoreLead({
    name: "Ada",
    email: "ada@example.com",
    message: "We are evaluating the product for a larger rollout across the sales team.",
  });

  if (score <= 10) {
    throw new Error(\`score was not increased: \${score}\`);
  }
}

export function testScoreLeadRewardsEnterpriseDomain(): void {
  const score = scoreLead({
    name: "Grace",
    email: "grace@enterprise.example",
    message: "Interested in a broader rollout.",
  });

  if (score < 35) {
    throw new Error(\`enterprise score was too low: \${score}\`);
  }
}

export function testScoreBand(): void {
  if (scoreBand(75) !== "hot") {
    throw new Error("expected hot score band");
  }
}
`,

  "docs/response.md": `# Response Behavior

Accepted leads return an id, score, band, and source.
Invalid leads return \`accepted: false\` with a stable rejection reason.
Rejected leads return an empty id and a cold score band.
`,
};

export const DIRTY_FILES = {
  ...TARGET_FILES,

  "src/config.ts": `export interface ServiceConfig {
  region: string;
  defaultSource: string;
  retryLimit: number;
  logLevel: "debug" | "info" | "warn";
}

export const config: ServiceConfig = {
  region: "local",
  defaultSource: "web",
  retryLimit: 2,
  logLevel: "debug",
};
`,

  "src/lead.ts": `${TARGET_FILES["src/lead.ts"]}
export function debugLeadSummary(payload: LeadPayload): string {
  return \`\${payload.name}:\${normalizeEmail(payload.email)}:\${payload.message ?? "none"}\`;
}
`,

  "notes/investigation.md": `# Investigation Notes

- Capture sample payloads for the next logging cleanup pass.
- Do not amend this investigation note into the benchmark commits.
`,
};

export const COMMIT_STATES = [
  {
    subject: "refactor validation helpers",
    files: COMMIT1_FILES,
  },
  {
    subject: "add app configuration",
    files: COMMIT2_FILES,
  },
  {
    subject: "add lead scoring",
    files: COMMIT3_FILES,
  },
  {
    subject: "add API handler",
    files: COMMIT4_FILES,
  },
  {
    subject: "document response behavior",
    files: COMMIT5_FILES,
  },
];

export const AMENDED_COMMIT_STATES = [
  {
    subject: "refactor validation helpers",
    files: {
      ...COMMIT1_FILES,
      "README.md": TARGET_FILES["README.md"]
        .replace(`## Scoring

- Assigns a score and score band to accepted leads.
- Uses the configured source when creating handler responses.

## Response Behavior

- Accepted responses include a lead id, score, band, and source.
- Rejected responses keep the id empty.
- Rejected responses include a reason that can be shown to operators.
`, "")
        .replace("Small TypeScript service used by the multi-amend benchmark pilot.\n\n", "Small TypeScript service used by the multi-amend benchmark pilot.\n\n"),
      "src/lead.ts": TARGET_FILES["src/lead.ts"]
        .replace(`export type ScoreBand = "cold" | "warm" | "hot";

`, "")
        .replace(`export function scoreLead(payload: LeadPayload): number {
  const email = normalizeEmail(payload.email);
  let score = 10;

  if (email.endsWith("@example.com")) {
    score += 5;
  }

  if (email.endsWith("@enterprise.example")) {
    score += 25;
  }

  if (payload.message && payload.message.length > 80) {
    score += 15;
  }

  return Math.min(score, 100);
}

export function scoreBand(score: number): ScoreBand {
  if (score >= 70) return "hot";
  if (score >= 30) return "warm";
  return "cold";
}
`, ""),
      "tests/lead.test.ts": `import { isValidLead, normalizeEmail } from "../src/lead";

export function testNormalizeEmail(): void {
  const email = normalizeEmail(" ADA@EXAMPLE.COM ");

  if (email !== "ada@example.com") {
    throw new Error(\`unexpected email: \${email}\`);
  }
}

export function testIsValidLeadRequiresName(): void {
  const valid = isValidLead({ name: "", email: "ada@example.com" });

  if (valid) {
    throw new Error("missing name should be rejected");
  }
}

export function testIsValidLeadRejectsMalformedEmail(): void {
  const valid = isValidLead({ name: "Ada", email: "not-an-email" });

  if (valid) {
    throw new Error("malformed email should be rejected");
  }
}
`,
    },
  },
  {
    subject: "add app configuration",
    files: {
      ...COMMIT2_FILES,
      "README.md": TARGET_FILES["README.md"]
        .replace(`## Scoring

- Assigns a score and score band to accepted leads.
- Uses the configured source when creating handler responses.

## Response Behavior

- Accepted responses include a lead id, score, band, and source.
- Rejected responses keep the id empty.
- Rejected responses include a reason that can be shown to operators.
`, ""),
      "src/lead.ts": TARGET_FILES["src/lead.ts"]
        .replace(`export type ScoreBand = "cold" | "warm" | "hot";

`, "")
        .replace(`export function scoreLead(payload: LeadPayload): number {
  const email = normalizeEmail(payload.email);
  let score = 10;

  if (email.endsWith("@example.com")) {
    score += 5;
  }

  if (email.endsWith("@enterprise.example")) {
    score += 25;
  }

  if (payload.message && payload.message.length > 80) {
    score += 15;
  }

  return Math.min(score, 100);
}

export function scoreBand(score: number): ScoreBand {
  if (score >= 70) return "hot";
  if (score >= 30) return "warm";
  return "cold";
}
`, ""),
      "tests/lead.test.ts": `import { isValidLead, normalizeEmail } from "../src/lead";

export function testNormalizeEmail(): void {
  const email = normalizeEmail(" ADA@EXAMPLE.COM ");

  if (email !== "ada@example.com") {
    throw new Error(\`unexpected email: \${email}\`);
  }
}

export function testIsValidLeadRequiresName(): void {
  const valid = isValidLead({ name: "", email: "ada@example.com" });

  if (valid) {
    throw new Error("missing name should be rejected");
  }
}

export function testIsValidLeadRejectsMalformedEmail(): void {
  const valid = isValidLead({ name: "Ada", email: "not-an-email" });

  if (valid) {
    throw new Error("malformed email should be rejected");
  }
}
`,
    },
  },
  {
    subject: "add lead scoring",
    files: {
      ...TARGET_FILES,
      "src/config.ts": COMMIT2_FILES["src/config.ts"],
      "src/handler.ts": undefined,
      "tests/handler.test.ts": undefined,
      "docs/response.md": undefined,
      "README.md": `# Lead Routing Service

Small TypeScript service used by the multi-amend benchmark pilot.

## Validation

- Requires a contact name and a likely email address before a lead can be accepted.
- Normalizes email casing before creating identifiers.
`,
    },
  },
  {
    subject: "add API handler",
    files: {
      ...TARGET_FILES,
      "src/config.ts": COMMIT2_FILES["src/config.ts"],
      "docs/response.md": undefined,
      "README.md": `# Lead Routing Service

Small TypeScript service used by the multi-amend benchmark pilot.

## Validation

- Requires a contact name and a likely email address before a lead can be accepted.
- Normalizes email casing before creating identifiers.

## Scoring

- Assigns a score and score band to accepted leads.
- Uses the configured source when creating handler responses.
`,
    },
  },
  {
    subject: "document response behavior",
    files: TARGET_FILES,
  },
];

export const ALL_KNOWN_PATHS = [
  ...new Set([
    ...Object.keys(MAIN_FILES),
    ...COMMIT_STATES.flatMap((state) => Object.keys(state.files)),
    ...Object.keys(TARGET_FILES),
    ...Object.keys(DIRTY_FILES),
  ]),
].filter(Boolean);
