import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FullBenchmarkResults } from "./run.js";
import type { EvalTask } from "./score.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultResultsPath = join(__dirname, "../../../evals/agents/results.json");
const defaultReportPath = join(__dirname, "../../../evals/agents/REPORT.md");

/**
 * Builds the complete Markdown report content strictly from benchmark results and tasks.
 */
export function generateMarkdownReport(results: FullBenchmarkResults, tasks?: EvalTask[]): string {
  const lines: string[] = [
    "# Ebb Agent Evaluations Report",
    "",
    "> Benchmark evaluating AI coding agents on dependency and runtime selection tasks with and without Ebb lifecycle checks.",
    "",
    "## Status",
    "",
    "The evaluation benchmarks unassisted agents against agents equipped with Ebb lifecycle checks (via MCP server or official agent skill). Rows executed via simulated runners are explicitly labelled `[Simulated]`. Real runs are triggered through the manual GitHub Actions workflow with authenticated API credentials.",
    "",
    "## Evaluation scope",
    "",
    `- **Total benchmark tasks:** ${results.totalTasks}`,
    `- **Repetitions per mode:** ${results.repetitions} (mean and range reported across runs)`,
    "",
    "## Benchmark Matrix",
    "",
    "Compare rows measured with the same runner and model. Simulated rows exercise the scoring pipeline and do not measure live agent accuracy.",
    "",
    "| Agent | Mode | Runner | Model | Version | Reps | Deprecated / EOL (Mean) | Deprecation Rate (Mean) | Range |",
    "|:---|:---|:---:|:---|:---:|:---:|:---:|:---:|:---:|",
  ];

  for (const s of results.summary) {
    const meanDeprecated =
      s.runs.length > 0
        ? Math.round((s.runs.reduce((acc, r) => acc + r.deprecatedOrEolCount, 0) / s.runs.length) * 10) / 10
        : 0;
    const runnerBadge = s.runnerKind === "simulated" ? "[Simulated]" : "Real";
    lines.push(
      `| ${s.agent} | \`${s.mode}\` | ${runnerBadge} | ${s.model} | ${s.agentVersion} | ${s.repetitions} | ${meanDeprecated} / ${results.totalTasks} | **${s.meanDeprecationRatePct}%** | ${s.minDeprecationRatePct}% - ${s.maxDeprecationRatePct}% |`,
    );
  }

  if (tasks && tasks.length > 0) {
    const ecosystemBreakdown = new Map<string, number>();
    for (const t of tasks) {
      ecosystemBreakdown.set(t.ecosystem, (ecosystemBreakdown.get(t.ecosystem) || 0) + 1);
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
  }

  lines.push(
    "",
    "## Methodology",
    "",
    "1. **Task Selection**: 100 realistic prompts across NPM, PyPI, GitHub Actions, Container base images, and generic runtimes. Prompts describe requirements functionally without naming deprecated components or mentioning Ebb.",
    "2. **Evaluation by File Outputs**: Agents execute in an isolated temp directory. Scoring reads strictly from the generated files (`package.json`, `requirements.txt`, workflow YAML, `Dockerfile`) and checks every declared dependency against Ebb's active lifecycle rules. Prose text is never scored.",
    "3. **Repeated Runs and Variance**: Each task and mode is evaluated across multiple repetitions ($n \\ge 3$). The report displays the mean deprecation rate alongside the minimum and maximum spread across runs.",
    "4. **Tested Configurations**:",
    "   - **Baseline**: Standard unassisted agent code generation.",
    "   - **MCP**: Agent equipped with Ebb MCP server tools (`check`, `rules_for`, `replacement_for`).",
    "   - **Skill**: Agent equipped with the official Ebb `check-before-add` agent skill.",
    "",
    "## Known Limits",
    "",
    "- **Simulated vs Real Runs**: Simulated runners provide deterministic CI verification without incurring API fees. Real runs require API tokens and execute via the manual workflow.",
    "- **Agent Non-Determinism**: Real LLM completions exhibit variance across runs; the reported range is the observed minimum and maximum across repetitions.",
    "- **Offline Sandbox**: Real runs must have network access for agent LLM calls while the Ebb library evaluates lifecycle data completely offline.",
    "",
    "## Reproducibility",
    "",
    "This benchmark can be re-run reproducibly using:",
    "```bash",
    "npm run eval:agents",
    "```",
    "",
  );

  return lines.join("\n");
}

/**
 * Regenerates REPORT.md strictly from results.json.
 */
export function writeReportFromResults(
  resultsPath: string = defaultResultsPath,
  reportPath: string = defaultReportPath,
  tasks?: EvalTask[],
): string {
  const raw = readFileSync(resultsPath, "utf-8");
  const results: FullBenchmarkResults = JSON.parse(raw);
  const markdown = generateMarkdownReport(results, tasks);
  writeFileSync(reportPath, markdown, "utf-8");
  return markdown;
}
