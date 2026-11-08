import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";

import {
  changedRuleIds,
  classifyChangedPaths,
  main,
  renderChangedRulesSummary,
  renderChangedRulesText,
  runChangedRules,
} from "../tools/changed-rules.js";

const RULE_ID = "npm.package.request.deprecated";

function registryText(summary = "The package is deprecated."): string {
  return `${JSON.stringify(
    {
      schemaVersion: "ebb.registry.v2",
      ecosystem: "npm",
      rules: [
        {
          id: RULE_ID,
          ecosystem: "npm",
          purl: "pkg:npm/request",
          vers: "vers:npm/*",
          event: "deprecated",
          title: "request is deprecated",
          summary,
          severity: "high",
          replacement: "Native fetch",
          sources: [{ title: "Deprecation notice", url: "https://example.com/request", accessedAt: "2026-01-01" }],
          provenance: { observedAt: "2026-01-01", reviewedAt: "2026-01-02", reviewer: "test" },
        },
      ],
    },
    null,
    2,
  )}\n`;
}

// The same rule with its keys written in another order. Only the content counts.
const REORDERED = `{
  "ecosystem": "npm",
  "rules": [
    {
      "id": "npm.package.request.deprecated",
      "provenance": { "reviewer": "test", "reviewedAt": "2026-01-02", "observedAt": "2026-01-01" },
      "sources": [ { "url": "https://example.com/request", "title": "Deprecation notice", "accessedAt": "2026-01-01" } ],
      "severity": "high",
      "replacement": "Native fetch",
      "summary": "The package is deprecated.",
      "title": "request is deprecated",
      "event": "deprecated",
      "vers": "vers:npm/*",
      "purl": "pkg:npm/request",
      "ecosystem": "npm"
    }
  ],
  "schemaVersion": "ebb.registry.v2"
}
`;

function git(root: string, ...args: string[]): string {
  return execFileSync(
    "git",
    ["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", ...args],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

function casesText(rules: string[] = [RULE_ID]): string {
  return `${JSON.stringify({ cases: [{ purl: "pkg:npm/request", version: "2.88.2", rules }] }, null, 2)}\n`;
}

/** A throwaway repository with one rule and one case for it, committed as the base revision. */
async function repository(): Promise<{ root: string; base: string }> {
  const root = await mkdtemp(join(tmpdir(), "ebb-changed-rules-"));
  await mkdir(join(root, "registry"), { recursive: true });
  await mkdir(join(root, "cases"), { recursive: true });
  await writeFile(join(root, "registry", "npm.json"), registryText());
  await writeFile(join(root, "cases", "npm.json"), casesText());
  await writeFile(join(root, "README.md"), "# Fixture\n");
  git(root, "init", "-q");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "base");
  return { root, base: git(root, "rev-parse", "HEAD").trim() };
}

async function commit(root: string, message: string): Promise<void> {
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", message);
}

test("changed paths select registry files and case files and ignore everything else", () => {
  const result = classifyChangedPaths([
    "registry/npm.json",
    "registry\\python.json",
    "registry/sources.lock.json",
    "registry/github-actions-shas.json",
    "registry/nested/npm.json",
    "README.md",
    "src/rule-lint.ts",
  ]);
  assert.deepEqual(result, { files: ["registry/npm.json", "registry/python.json"], cases: false });
  assert.equal(classifyChangedPaths(["cases/npm.json"]).cases, true);
});

test("a new, changed, or reordered rule is reported; an unchanged or deleted one is not", () => {
  assert.deepEqual(changedRuleIds(undefined, registryText()), [RULE_ID]);
  assert.deepEqual(changedRuleIds(registryText(), registryText("Changed.")), [RULE_ID]);
  assert.deepEqual(changedRuleIds(registryText(), REORDERED), []);
  assert.deepEqual(changedRuleIds(registryText(), registryText()), []);
  assert.deepEqual(
    changedRuleIds(registryText(), JSON.stringify({ schemaVersion: "ebb.registry.v2", ecosystem: "npm", rules: [] })),
    [],
  );
});

test("refreshing a source access date is not a rule change", () => {
  const refreshed = registryText().replace('"accessedAt": "2026-01-01"', '"accessedAt": "2026-06-01"');
  assert.notEqual(refreshed, registryText());
  assert.deepEqual(changedRuleIds(registryText(), refreshed), []);
});

test("a changed rule is linted, its cases are checked, and it is named in the summary", async () => {
  const { root, base } = await repository();
  try {
    await writeFile(join(root, "registry", "npm.json"), registryText("Changed summary."));
    await commit(root, "change");
    const result = await runChangedRules({ base, root });
    assert.equal(result.passed, true);
    assert.deepEqual(result.files, ["registry/npm.json"]);
    assert.deepEqual(result.rules, [RULE_ID]);
    assert.equal(result.cases.checked, 1);
    const summary = renderChangedRulesSummary(result);
    assert.match(summary, new RegExp(`\\| \`${RULE_ID.replaceAll(".", "\\.")}\` \\| pass \\|`));
    assert.match(summary, /checked 1 case\./);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a rule change that breaks a case fails and names the case", async () => {
  const { root, base } = await repository();
  try {
    await writeFile(join(root, "registry", "npm.json"), registryText().replace("vers:npm/*", "vers:npm/<2.0.0"));
    await commit(root, "narrow");
    const result = await runChangedRules({ base, root });
    assert.equal(result.passed, false);
    assert.match(
      renderChangedRulesText(result),
      /pkg:npm\/request@2\.88\.2 expected npm\.package\.request\.deprecated, got no rule/,
    );
    assert.match(renderChangedRulesSummary(result), /#### Case problems/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a changed case file runs every case", async () => {
  const { root, base } = await repository();
  try {
    await writeFile(join(root, "cases", "npm.json"), casesText([]));
    await commit(root, "wrong case");
    const result = await runChangedRules({ base, root });
    assert.equal(result.passed, false);
    assert.deepEqual(result.files, []);
    assert.equal(result.cases.checked, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a lint problem in a changed registry file fails and names the rule and field", async () => {
  const { root, base } = await repository();
  try {
    await writeFile(
      join(root, "registry", "npm.json"),
      registryText().replace("https://example.com", "http://example.com"),
    );
    await commit(root, "http");
    const result = await runChangedRules({ base, root });
    assert.equal(result.passed, false);
    assert.ok(result.lint.issues.some((issue) => issue.ruleId === RULE_ID));
    assert.match(renderChangedRulesSummary(result), /#### Lint problems/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a pull request that touches no rule reports that nothing changed", async () => {
  const { root, base } = await repository();
  try {
    await writeFile(join(root, "README.md"), "# Changed\n");
    await commit(root, "docs");
    const result = await runChangedRules({ base, root });
    assert.equal(result.passed, true);
    assert.equal(renderChangedRulesText(result), "No rule changed in this pull request.");
    assert.match(renderChangedRulesSummary(result), /No rule changed in this pull request\./);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("--all lints every registry and checks every case", async () => {
  const { root } = await repository();
  try {
    const result = await runChangedRules({ root });
    assert.equal(result.passed, true);
    assert.deepEqual(result.files, ["registry/npm.json"]);
    assert.equal(result.cases.checked, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the command exits 1, names the case, and writes the summary when a case breaks", async () => {
  const { root, base } = await repository();
  try {
    await writeFile(join(root, "registry", "npm.json"), registryText().replace("vers:npm/*", "vers:npm/<2.0.0"));
    await commit(root, "narrow");
    const summary = join(root, "summary.md");
    const child = spawnSync(
      process.execPath,
      [resolve("dist/tools/changed-rules.js"), "--base", base, "--summary", summary],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(child.status, 1, child.stderr);
    assert.match(child.stderr, /Rule changes failed: pkg:npm\/request@2\.88\.2/);
    assert.match(await readFile(summary, "utf8"), /### Changed rules/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the command needs a base ref or --all and rejects unknown flags", async () => {
  await assert.rejects(main([]), /Usage: changed-rules \(--base <ref> \| --all\)/);
  await assert.rejects(main(["--base", "main", "--all"]), /Usage: changed-rules/);
  await assert.rejects(main(["--base"]), /--base needs a value/);
  await assert.rejects(main(["--base", "main", "--json"]), /Unknown argument "--json"/);
});

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
}

interface Workflow {
  on: Record<string, { paths?: string[] } | null>;
  permissions?: Record<string, string>;
  jobs: Record<string, { permissions?: Record<string, string>; steps: Step[] }>;
}

const workflowText = await readFile(resolve(".github/workflows/rules.yml"), "utf8");
const workflow = parse(workflowText) as Workflow;
const workflowJob = workflow.jobs.rules!;

test("the rules workflow runs on pushes to main and on pull requests for rule and case changes only", () => {
  assert.deepEqual(Object.keys(workflow.on), ["push", "pull_request"]);
  assert.deepEqual(workflow.on.pull_request!.paths, workflow.on.push!.paths);
  const paths = workflow.on.push!.paths!;
  for (const path of [
    "registry/**",
    "cases/**",
    "src/rule-lint.ts",
    "tools/changed-rules.ts",
    "tools/rule-cases.ts",
    ".github/workflows/rules.yml",
  ]) {
    assert.ok(paths.includes(path), path);
  }
  assert.ok(!workflowText.includes("pull_request_target"));
});

test("the rules workflow has read-only permissions and no secret", () => {
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.equal(workflowJob.permissions, undefined);
  assert.ok(!/secrets\./.test(workflowText));
});

test("the base commit reaches the rules shell only through an environment variable", () => {
  for (const step of workflowJob.steps.filter((item) => item.run)) {
    assert.ok(!/\$\{\{/.test(step.run!), `an expression is interpolated into a run script: ${step.name ?? step.run}`);
  }
  const check = workflowJob.steps.find((step) => step.run?.includes("changed-rules"))!;
  assert.equal(check.env?.BASE_SHA, "${{ github.event.pull_request.base.sha || github.event.before }}");
  assert.match(check.run!, /git fetch --no-tags origin "\$BASE_SHA"/);
  assert.match(check.run!, /--base "\$BASE_SHA"/);
  assert.match(check.run!, /\^0\+\$ \]\]; then\n\s+node dist\/tools\/changed-rules\.js --all/);
  assert.match(check.run!, /--summary "\$GITHUB_STEP_SUMMARY"/);
});

test("the rules workflow checks out history and pins every action to a full SHA", () => {
  assert.equal(workflowJob.steps[0]!.with?.["fetch-depth"], 0);
  for (const step of workflowJob.steps.filter((item) => item.uses)) {
    // `./` and `$/` resolve inside this repository, so neither carries a pinned ref.
    if (step.uses!.startsWith("$/") || step.uses!.startsWith("./")) continue;
    assert.match(step.uses!, /^[\w./-]+@[0-9a-f]{40}$/, step.uses);
  }
});
