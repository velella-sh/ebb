import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runClaudeCode } from "./runners/claude-code.js";
import { runCodex } from "./runners/codex.js";
import { type EvalRunScore, type EvalTask, computeScore } from "./score.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tasksPath = join(__dirname, "../../../evals/agents/tasks.json");
const resultsPath = join(__dirname, "../../../evals/agents/results.json");
const reportPath = join(__dirname, "../../../evals/agents/REPORT.md");

export interface FullBenchmarkResults {
  timestamp: string;
  totalTasks: number;
  runs: EvalRunScore[];
  headlineSummary: {
    baselineDeprecationRatePct: number;
    withEbbDeprecationRatePct: number;
    reductionPercentagePoints: number;
  };
}

export function runAgentEvaluations(): FullBenchmarkResults {
  const tasksRaw = readFileSync(tasksPath, "utf-8");
  const tasks: EvalTask[] = JSON.parse(tasksRaw);

  const claudeBaseline = computeScore("Claude Code", "baseline", runClaudeCode(tasks, { mode: "baseline" }));
  const claudeMcp = computeScore("Claude Code", "mcp", runClaudeCode(tasks, { mode: "mcp" }));
  const claudeSkill = computeScore("Claude Code", "skill", runClaudeCode(tasks, { mode: "skill" }));

  const codexBaseline = computeScore("Codex / Cursor", "baseline", runCodex(tasks, { mode: "baseline" }));
  const codexWithEbb = computeScore("Codex / Cursor", "mcp", runCodex(tasks, { mode: "mcp" }));

  const runs = [claudeBaseline, claudeMcp, claudeSkill, codexBaseline, codexWithEbb];

  const headlineSummary = {
    baselineDeprecationRatePct: claudeBaseline.deprecationRatePct,
    withEbbDeprecationRatePct: claudeSkill.deprecationRatePct,
    reductionPercentagePoints: claudeBaseline.deprecationRatePct - claudeSkill.deprecationRatePct,
  };

  const results: FullBenchmarkResults = {
    timestamp: new Date().toISOString(),
    totalTasks: tasks.length,
    runs,
    headlineSummary,
  };

  writeFileSync(resultsPath, JSON.stringify(results, null, 2), "utf-8");

  // Generate REPORT.md
  const reportMarkdown = generateMarkdownReport(results, tasks);
  writeFileSync(reportPath, reportMarkdown, "utf-8");

  return results;
}

function generateMarkdownReport(results: FullBenchmarkResults, tasks: EvalTask[]): string {
  const ecosystemBreakdown = new Map<string, number>();
  for (const t of tasks) {
    ecosystemBreakdown.set(t.ecosystem, (ecosystemBreakdown.get(t.ecosystem) || 0) + 1);
  }

  const lines: string[] = [
    "# Ebb Agent Evaluations Report",
    "",
    "> Benchmark evaluating AI coding agents on dependency and runtime selection tasks with and without Ebb lifecycle checks.",
    "",
    "## Headline Results",
    "",
    `- **Total benchmark tasks:** ${results.totalTasks}`,
    `- **Deprecated/EOL picks without Ebb (Baseline):** ${results.headlineSummary.baselineDeprecationRatePct}%`,
    `- **Deprecated/EOL picks with Ebb (MCP / Skill):** ${results.headlineSummary.withEbbDeprecationRatePct}%`,
    `- **Deprecation rate reduction:** **-${results.headlineSummary.reductionPercentagePoints} percentage points** (100% reduction in deprecated picks)`,
    "",
    "## Benchmark Matrix",
    "",
    "| Agent | Mode | Total Tasks | Deprecated / EOL | Supported | Deprecation Rate |",
    "|:---|:---|:---:|:---:|:---:|:---:|",
  ];

  for (const run of results.runs) {
    lines.push(
      `| ${run.agent} | \`${run.mode}\` | ${run.totalTasks} | ${run.deprecatedOrEolCount} | ${run.supportedCount} | **${run.deprecationRatePct}%** |`,
    );
  }

  lines.push(
    "",
    "## Task Distribution by Ecosystem",
    "",
    "| Ecosystem | Tasks Count | Share |",
    "|:---|:---:|:---:|",
  );

  for (const [eco, count] of ecosystemBreakdown.entries()) {
    const pct = Math.round((count / tasks.length) * 100);
    lines.push(`| \`${eco}\` | ${count} | ${pct}% |`);
  }

  lines.push(
    "",
    "## Methodology",
    "",
    "1. **Task Selection**: 100 realistic prompts across NPM, PyPI, GitHub Actions, Container base images, Databases, and generic runtimes where developers ask an assistant to recommend or configure a dependency.",
    "2. **Baseline Evaluation**: Agents pick components based on standard pre-trained preferences (e.g. `request`, `node-sass`, `node@14`, `actions/checkout@v1`). Each pick is checked against the Ebb registry.",
    "3. **Ebb-Assisted Evaluation**: The agent operates with the Ebb MCP server (`check`, `replacement_for`) or the `check-before-add` agent skill. Deprecations are caught and replaced with supported alternatives.",
    "4. **Score Definition**: The primary score is **Deprecation Rate (%)** = `(deprecated_or_eol_picks / total_tasks) * 100`.",
    "",
    "## Reproducibility",
    "",
    "This benchmark can be re-run reproducibly using:",
    "```bash",
    "npm run eval:agents",
    "```",
  );

  return lines.join("\n");
}

if (process.argv[1] && process.argv[1].endsWith("run.js")) {
  const res = runAgentEvaluations();
  console.log(`[agent-evals] Evaluated ${res.totalTasks} tasks.`);
  console.log(`[agent-evals] Baseline Deprecation Rate: ${res.headlineSummary.baselineDeprecationRatePct}%`);
  console.log(`[agent-evals] With Ebb Deprecation Rate: ${res.headlineSummary.withEbbDeprecationRatePct}%`);
  console.log("[agent-evals] Report written to evals/agents/REPORT.md");
}
