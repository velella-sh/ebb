import { runAgentEvaluations } from "../evals/agents/run.js";

const res = runAgentEvaluations();
console.log(`[agent-evals] Evaluated ${res.totalTasks} tasks.`);
console.log(`[agent-evals] Baseline Deprecation Rate: ${res.headlineSummary.baselineDeprecationRatePct}%`);
console.log(`[agent-evals] With Ebb Deprecation Rate: ${res.headlineSummary.withEbbDeprecationRatePct}%`);
console.log("[agent-evals] Raw results saved to evals/agents/results.json");
console.log("[agent-evals] Report written to evals/agents/REPORT.md");
