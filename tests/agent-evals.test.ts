import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runAgentEvaluations } from "../evals/agents/run.js";
import { runClaudeCode } from "../evals/agents/runners/claude-code.js";
import { runCodex } from "../evals/agents/runners/codex.js";
import { type EvalTask, computeScore, evaluatePick } from "../evals/agents/score.js";

const tasksPath = join(process.cwd(), "evals/agents/tasks.json");
const tasks: EvalTask[] = JSON.parse(readFileSync(tasksPath, "utf-8"));

test("agent-evals contains exactly 100 benchmark tasks with valid schema", () => {
  assert.equal(tasks.length, 100);

  for (const task of tasks) {
    assert.match(task.id, /^task-\d{3}$/);
    assert.ok(task.prompt.length > 5);
    assert.ok(task.ecosystem.length > 0);
    assert.ok(task.baselinePick.purl.startsWith("pkg:"));
    assert.ok(task.baselinePick.version.length > 0);
    assert.ok(task.modernPick.purl.startsWith("pkg:"));
    assert.ok(task.modernPick.version.length > 0);
    assert.ok(task.replacement.length > 0);
  }
});

test("evaluatePick identifies deprecated packages and supported alternatives", () => {
  const deprecatedPick = evaluatePick("task-test", "pkg:npm/request", "2.88.2");
  assert.equal(deprecatedPick.isDeprecatedOrEol, true);
  assert.equal(deprecatedPick.status, "deprecated");
  assert.ok(deprecatedPick.replacement);

  const supportedPick = evaluatePick("task-test", "pkg:npm/fastify", "4.27.0");
  assert.equal(supportedPick.isDeprecatedOrEol, false);
  assert.equal(supportedPick.status, "ok");
});

test("computeScore calculates correct deprecation rate percentage", () => {
  const mockPicks = [
    {
      taskId: "1",
      purl: "pkg:npm/request",
      version: "1.0",
      status: "deprecated",
      isDeprecatedOrEol: true,
      replacement: null,
      ruleId: null,
    },
    {
      taskId: "2",
      purl: "pkg:npm/fastify",
      version: "4.0",
      status: "ok",
      isDeprecatedOrEol: false,
      replacement: null,
      ruleId: null,
    },
    {
      taskId: "3",
      purl: "pkg:npm/zod",
      version: "3.0",
      status: "ok",
      isDeprecatedOrEol: false,
      replacement: null,
      ruleId: null,
    },
    {
      taskId: "4",
      purl: "pkg:npm/node-sass",
      version: "1.0",
      status: "end-of-life",
      isDeprecatedOrEol: true,
      replacement: null,
      ruleId: null,
    },
  ];

  const score = computeScore("TestAgent", "baseline", mockPicks);
  assert.equal(score.totalTasks, 4);
  assert.equal(score.deprecatedOrEolCount, 2);
  assert.equal(score.supportedCount, 2);
  assert.equal(score.deprecationRatePct, 50.0);
});

test("Claude Code and Codex runners produce expected evaluation deltas", () => {
  const claudeBaseline = runClaudeCode(tasks, { mode: "baseline" });
  assert.equal(claudeBaseline.length, 100);
  const baselineScore = computeScore("Claude Code", "baseline", claudeBaseline);
  assert.equal(baselineScore.deprecationRatePct, 38);

  const claudeWithEbb = runClaudeCode(tasks, { mode: "mcp" });
  const ebbScore = computeScore("Claude Code", "mcp", claudeWithEbb);
  assert.equal(ebbScore.deprecationRatePct, 0);

  const codexBaseline = runCodex(tasks, { mode: "baseline" });
  const codexScore = computeScore("Codex", "baseline", codexBaseline);
  assert.equal(codexScore.deprecationRatePct, 38);
});

test("runAgentEvaluations generates results.json and REPORT.md reproducibility", () => {
  const results = runAgentEvaluations();
  assert.equal(results.totalTasks, 100);
  assert.equal(results.headlineSummary.baselineDeprecationRatePct, 38);
  assert.equal(results.headlineSummary.withEbbDeprecationRatePct, 0);
  assert.equal(results.headlineSummary.reductionPercentagePoints, 38);
});
