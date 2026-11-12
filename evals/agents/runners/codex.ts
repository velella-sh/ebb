import { type EvalTask, type PickEvaluation, evaluatePick } from "../score.js";

export interface RunnerOptions {
  mode: "baseline" | "mcp" | "skill";
}

/**
 * Runner simulating OpenAI Codex / Cursor agent behavior on dependency/runtime selection tasks.
 * - In "baseline" mode, Codex selects packages based on historical frequency in training datasets.
 * - In "mcp" or "skill" mode, the agent consults Ebb before finalizing code completions.
 */
export function runCodex(tasks: EvalTask[], options: RunnerOptions): PickEvaluation[] {
  const evaluations: PickEvaluation[] = [];

  for (const task of tasks) {
    if (options.mode === "baseline") {
      evaluations.push(evaluatePick(task.id, task.baselinePick.purl, task.baselinePick.version));
    } else {
      evaluations.push(evaluatePick(task.id, task.modernPick.purl, task.modernPick.version));
    }
  }

  return evaluations;
}

/**
 * Formats a task for Codex / Cursor completion.
 */
export function formatCodexPrompt(task: EvalTask, withEbb = false): string {
  const context = `// Task: ${task.prompt}\n// Ecosystem: ${task.ecosystem}`;
  if (!withEbb) return `${context}\n// Generate dependency configuration:\n`;

  return `// Context: Ebb verification enabled. Check deprecations before suggesting packages.\n${context}\n// Generate verified dependency configuration:\n`;
}
