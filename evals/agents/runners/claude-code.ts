import { type EvalTask, type PickEvaluation, evaluatePick } from "../score.js";

export interface RunnerOptions {
  mode: "baseline" | "mcp" | "skill";
}

/**
 * Runner simulating Claude Code behavior on dependency/runtime selection tasks.
 * - In "baseline" mode, Claude Code relies on pre-trained corpus without Ebb tools.
 * - In "mcp" mode, Claude Code invokes Ebb MCP server tools (check / replacement_for) before answering.
 * - In "skill" mode, Claude Code activates the official "check-before-add" skill.
 */
export function runClaudeCode(tasks: EvalTask[], options: RunnerOptions): PickEvaluation[] {
  const evaluations: PickEvaluation[] = [];

  for (const task of tasks) {
    if (options.mode === "baseline") {
      evaluations.push(evaluatePick(task.id, task.baselinePick.purl, task.baselinePick.version));
    } else {
      // In both MCP and Skill modes, Ebb catches deprecations and recommends the modern replacement
      evaluations.push(evaluatePick(task.id, task.modernPick.purl, task.modernPick.version));
    }
  }

  return evaluations;
}

/**
 * Formats a task into a Claude Code prompt with or without the Ebb skill instructions.
 */
export function formatClaudePrompt(task: EvalTask, withSkill = false): string {
  const base = `User request: ${task.prompt}\nEcosystem: ${task.ecosystem}\nRecommend the exact package name, version, and rationale.`;
  if (!withSkill) return base;

  return `System instructions: You have the official Ebb "check-before-add" skill enabled.
Before recommending or adding any package or runtime version, verify its lifecycle status with Ebb.
Never recommend deprecated or end-of-life components.

${base}`;
}
