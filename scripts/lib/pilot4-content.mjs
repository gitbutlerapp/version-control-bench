export const TASK_BRANCH = "reorder-series";

export const MAIN_FILES = {
  "README.md": `# Notification Service

Tiny TypeScript repo used by the reorder-commit benchmark pilot.
`,

  "package.json": `{
  "name": "notification-service",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "node tests/customer.test.ts && node tests/email.test.ts && node tests/retry.test.ts && node tests/notification.test.ts"
  },
  "dependencies": {},
  "devDependencies": {}
}
`,
};

export const CONFIG_FILES = {
  ...MAIN_FILES,

  "src/config.ts": `export interface AppConfig {
  region: string;
  senderAddress: string;
  retryLimit: number;
}

export const config: AppConfig = {
  region: "local",
  senderAddress: "alerts@example.com",
  retryLimit: 3,
};
`,
};

export const CUSTOMER_FILES = {
  ...CONFIG_FILES,

  "src/customer.ts": `export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export function customerDisplayName(customer: Customer): string {
  return \`\${customer.firstName} \${customer.lastName}\`.trim();
}
`,

  "tests/customer.test.ts": `import { customerDisplayName } from "../src/customer";

export function testCustomerDisplayName(): void {
  const name = customerDisplayName({
    id: "cus_123",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
  });

  if (name !== "Ada Lovelace") {
    throw new Error(\`unexpected name: \${name}\`);
  }
}
`,
};

export const EMAIL_FILES = {
  ...CUSTOMER_FILES,

  "src/email.ts": `export interface NotificationEmail {
  to: string;
  subject: string;
  body: string;
}

export function formatNotificationEmail(to: string, subject: string, body: string): NotificationEmail {
  return {
    to: to.trim().toLowerCase(),
    subject: subject.trim(),
    body: body.trim(),
  };
}
`,

  "tests/email.test.ts": `import { formatNotificationEmail } from "../src/email";

export function testFormatNotificationEmail(): void {
  const email = formatNotificationEmail(" ADA@EXAMPLE.COM ", " Welcome ", " Hello ");

  if (email.to !== "ada@example.com" || email.subject !== "Welcome" || email.body !== "Hello") {
    throw new Error("email was not normalized");
  }
}
`,
};

export const RETRY_FILES = {
  ...EMAIL_FILES,

  "src/retry.ts": `export function nextRetryDelay(attempt: number): number {
  if (attempt <= 0) return 0;
  return Math.min(30_000, attempt * 1_000);
}
`,

  "tests/retry.test.ts": `import { nextRetryDelay } from "../src/retry";

export function testNextRetryDelay(): void {
  if (nextRetryDelay(3) !== 3_000) {
    throw new Error("unexpected retry delay");
  }
}
`,
};

export const SENDER_FILES = {
  ...RETRY_FILES,

  "src/notification.ts": `export interface NotificationPayload {
  customerId: string;
  channel: "email" | "sms";
  message: string;
}

export function buildNotificationPayload(customerId: string, message: string): NotificationPayload {
  return {
    customerId,
    channel: "email",
    message: message.trim(),
  };
}
`,

  "tests/notification.test.ts": `import { buildNotificationPayload } from "../src/notification";

export function testBuildNotificationPayload(): void {
  const payload = buildNotificationPayload("cus_123", " Your invoice is ready ");

  if (payload.customerId !== "cus_123" || payload.message !== "Your invoice is ready") {
    throw new Error("payload was not normalized");
  }
}
`,
};

export const DOC_FILES = {
  ...SENDER_FILES,

  "README.md": `# Notification Service

Tiny TypeScript repo used by the reorder-commit benchmark pilot.

Operational notes live in docs/notification-flow.md.
`,

  "docs/notification-flow.md": `# Notification Flow

Notifications are prepared from customer records, formatted for the selected channel, and retried when delivery fails.
`,
};

export const INITIAL_COMMIT_STATES = [
  {
    subject: "add app configuration",
    files: CONFIG_FILES,
  },
  {
    subject: "add customer model",
    files: CUSTOMER_FILES,
  },
  {
    subject: "add email formatter",
    files: EMAIL_FILES,
  },
  {
    subject: "add retry policy",
    files: RETRY_FILES,
  },
  {
    subject: "add notification sender",
    files: SENDER_FILES,
  },
  {
    subject: "document notification flow",
    files: DOC_FILES,
  },
];

export const EXPECTED_COMMIT_SUBJECTS = [
  "add app configuration",
  "add retry policy",
  "add notification sender",
  "add customer model",
  "add email formatter",
  "document notification flow",
];

export const EXPECTED_BRANCH_FILES = DOC_FILES;

export const COMMIT_EXPECTATIONS = {
  "add app configuration": {
    paths: ["src/config.ts"],
    snippets: ["export interface AppConfig", "retryLimit: 3"],
  },
  "add customer model": {
    paths: ["src/customer.ts", "tests/customer.test.ts"],
    snippets: ["export interface Customer", "testCustomerDisplayName"],
  },
  "add email formatter": {
    paths: ["src/email.ts", "tests/email.test.ts"],
    snippets: ["formatNotificationEmail", "testFormatNotificationEmail"],
  },
  "add retry policy": {
    paths: ["src/retry.ts", "tests/retry.test.ts"],
    snippets: ["nextRetryDelay", "testNextRetryDelay"],
  },
  "add notification sender": {
    paths: ["src/notification.ts", "tests/notification.test.ts"],
    snippets: ["buildNotificationPayload", "testBuildNotificationPayload"],
  },
  "document notification flow": {
    paths: ["README.md", "docs/notification-flow.md"],
    snippets: ["docs/notification-flow.md", "Notification Flow"],
  },
};

export const ALL_KNOWN_PATHS = [...new Set([
  ...Object.keys(MAIN_FILES),
  ...Object.keys(DOC_FILES),
])].sort();
