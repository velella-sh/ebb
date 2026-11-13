/**
 * Example: Inspecting GitHub Actions workflows for deprecated or unsupported actions.
 *
 * Usage:
 *   node --experimental-strip-types examples/github-actions/check-workflow.ts [path/to/workflow.yml]
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check, replacementFor } from "../../dist/src/index.js";

export interface GitHubActionReference {
  action: string;
  ref: string;
  purl: string;
  line: number;
}

export function parseWorkflowFile(workflowPath: string): GitHubActionReference[] {
  if (!existsSync(workflowPath)) {
    throw new Error(`Workflow file not found at: ${workflowPath}`);
  }

  const content = readFileSync(workflowPath, "utf-8");
  const lines = content.split("\n");
  const actions: GitHubActionReference[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!.trim();
    if (!raw || raw.startsWith("#")) continue;

    // Matches `uses: actions/checkout@v2` or `uses: "docker/build-push-action@v2"`
    const match = raw.match(/uses:\s*["']?([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)@([a-zA-Z0-9_.-]+)["']?/);
    if (match && match[1] && match[2]) {
      const actionName = match[1];
      const actionRef = match[2];
      actions.push({
        action: actionName,
        ref: actionRef,
        purl: `pkg:github/${actionName}`,
        line: i + 1,
      });
    }
  }

  return actions;
}

export function evaluateWorkflow(workflowPath: string) {
  const actions = parseWorkflowFile(workflowPath);
  const results = actions.map((item) => {
    const evaluation = check(item.purl, item.ref);
    const repl = replacementFor(item.purl, item.ref) ?? evaluation.matches[0]?.replacement;
    return {
      ...item,
      status: evaluation.status,
      rule: evaluation.matches[0]?.ruleId,
      replacement: repl,
      evaluation,
    };
  });

  return {
    workflowPath,
    total: actions.length,
    results,
    findings: results.filter((r) => r.status !== "ok"),
  };
}

// Execute when invoked directly
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  const targetPath = resolve(process.argv[2] ?? resolve(dirname(__filename), "workflow.yml"));
  console.log(`Scanning GitHub Actions workflow at: ${targetPath}\n`);

  const report = evaluateWorkflow(targetPath);

  console.log(`Evaluated ${report.total} action reference(s):`);
  for (const item of report.results) {
    const symbol = item.status === "ok" ? "✓" : "✖";
    console.log(`  ${symbol} line ${item.line}: ${item.action}@${item.ref} -> ${item.status}`);
  }

  if (report.findings.length > 0) {
    console.log("\n⚠️  Identified Deprecated or Unsupported Actions:");
    for (const item of report.findings) {
      console.log(`\n• Line ${item.line}: ${item.action}@${item.ref} (${item.purl}@${item.ref}) -> ${item.status.toUpperCase()}`);
      if (item.rule) console.log(`  Rule: ${item.rule}`);
      if (item.replacement) console.log(`  Replacement: ${item.replacement}`);
    }
  } else {
    console.log("\n✅ All GitHub Actions in this workflow are active and supported.");
  }
}
