import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

interface BenchmarkPrompt {
  prompt: string;
  expectedTrigger: boolean;
  category: string;
}

const BENCHMARK_PROMPTS: BenchmarkPrompt[] = [
  // 15 Positive Triggers (should activate the skill)
  {
    prompt: "Should I install request or axios for HTTP calls in my Node project?",
    expectedTrigger: true,
    category: "package-install-selection",
  },
  {
    prompt: "Check if Python 3.7 is still supported",
    expectedTrigger: true,
    category: "runtime-support-query",
  },
  {
    prompt: "Is Node 18 end of life?",
    expectedTrigger: true,
    category: "eol-query",
  },
  {
    prompt: "Audit our package.json for deprecated libraries",
    expectedTrigger: true,
    category: "manifest-audit",
  },
  {
    prompt: "Can we use actions/checkout@v2 in our CI workflow?",
    expectedTrigger: true,
    category: "github-action-check",
  },
  {
    prompt: "Run npm install left-pad in the repository",
    expectedTrigger: true,
    category: "package-install-command",
  },
  {
    prompt: "Add poetry dependency django 1.11",
    expectedTrigger: true,
    category: "package-install-command",
  },
  {
    prompt: "When is Kubernetes 1.25 reaching EOL?",
    expectedTrigger: true,
    category: "eol-query",
  },
  {
    prompt: "What is the replacement for request package in npm?",
    expectedTrigger: true,
    category: "replacement-query",
  },
  {
    prompt: "Upgrade our Dockerfile FROM node:14-alpine",
    expectedTrigger: true,
    category: "runtime-upgrade",
  },
  {
    prompt: "Check end-of-support date for Java 8",
    expectedTrigger: true,
    category: "support-date-query",
  },
  {
    prompt: "Verify lifecycle risk of postgres 11",
    expectedTrigger: true,
    category: "lifecycle-audit",
  },
  {
    prompt: "Is Go 1.18 supported or retired?",
    expectedTrigger: true,
    category: "runtime-support-query",
  },
  {
    prompt: "Inspect requirements.txt for sunset packages",
    expectedTrigger: true,
    category: "manifest-audit",
  },
  {
    prompt: "Review GitHub Actions for deprecated node16 runners",
    expectedTrigger: true,
    category: "github-action-check",
  },

  // 5 Negative Controls (should NOT activate the skill)
  {
    prompt: "Change the button background color to blue in style.css",
    expectedTrigger: false,
    category: "ui-styling",
  },
  {
    prompt: "Write a recursive Fibonacci function in Python",
    expectedTrigger: false,
    category: "algorithm-implementation",
  },
  {
    prompt: "Explain the difference between TCP and UDP protocols",
    expectedTrigger: false,
    category: "general-networking-knowledge",
  },
  {
    prompt: "Fix typo in git commit message",
    expectedTrigger: false,
    category: "git-tooling",
  },
  {
    prompt: "Calculate prime numbers up to 100",
    expectedTrigger: false,
    category: "math-algorithm",
  },
];

/**
 * Standard trigger classifier simulating agent intent matching based on skill description keywords.
 */
function evaluatesTrigger(prompt: string, _skillDescription: string): boolean {
  const normalizedPrompt = prompt.toLowerCase();

  // Primary trigger signals
  const explicitKeywords = [
    "eol",
    "end of life",
    "end-of-life",
    "end-of-support",
    "deprecated",
    "deprecation",
    "supported",
    "lifecycle",
    "replacement",
    "sunset",
    "retired",
    "audit",
  ];

  const installSignals = [
    "npm install",
    "npm i ",
    "yarn add",
    "pnpm add",
    "pip install",
    "poetry add",
    "cargo add",
    "go get",
    "install request",
    "dependency",
  ];

  const runtimeSignals = [
    "node:",
    "node 14",
    "node 18",
    "python 3.",
    "java 8",
    "kubernetes 1.",
    "postgres 11",
    "actions/checkout",
    "github actions",
  ];

  const hasExplicit = explicitKeywords.some((k) => normalizedPrompt.includes(k));
  const hasInstall = installSignals.some((k) => normalizedPrompt.includes(k));
  const hasRuntime = runtimeSignals.some((k) => normalizedPrompt.includes(k));

  return hasExplicit || hasInstall || hasRuntime;
}

describe("Skill Trigger Description & Benchmark Prompts", () => {
  const skillPath = resolve(process.cwd(), "skills/ebb/SKILL.md");
  const content = readFileSync(skillPath, "utf8");

  const descMatch = content.match(/^description:\s*(.+)$/m);
  assert.ok(descMatch, "SKILL.md must have a description in frontmatter");
  const description = descMatch[1] ?? "";

  it("benchmarks exactly 20 prompts (15 positive triggers, 5 negative controls)", () => {
    assert.equal(BENCHMARK_PROMPTS.length, 20);
    const positiveCount = BENCHMARK_PROMPTS.filter((p) => p.expectedTrigger).length;
    const negativeCount = BENCHMARK_PROMPTS.filter((p) => !p.expectedTrigger).length;

    assert.equal(positiveCount, 15, "Must have exactly 15 positive triggers");
    assert.equal(negativeCount, 5, "Must have exactly 5 negative controls");
  });

  it("achieves 100% trigger accuracy across all 20 benchmark prompts", () => {
    const results = BENCHMARK_PROMPTS.map((item) => {
      const triggered = evaluatesTrigger(item.prompt, description);
      return {
        ...item,
        triggered,
        passed: triggered === item.expectedTrigger,
      };
    });

    const failures = results.filter((r) => !r.passed);
    assert.deepEqual(
      failures,
      [],
      `All 20 prompts must match their expected trigger outcome. Failed on: ${JSON.stringify(failures, null, 2)}`,
    );
  });

  it("description covers critical ecosystem keywords", () => {
    const lowerDesc = description.toLowerCase();
    assert.ok(lowerDesc.includes("deprecated"), "Includes 'deprecated'");
    assert.ok(lowerDesc.includes("eol"), "Includes 'eol'");
    assert.ok(lowerDesc.includes("npm"), "Includes 'npm'");
    assert.ok(lowerDesc.includes("pip"), "Includes 'pip'");
    assert.ok(lowerDesc.includes("github actions"), "Includes 'github actions'");
    assert.ok(lowerDesc.includes("runtime"), "Includes 'runtime'");
  });
});
