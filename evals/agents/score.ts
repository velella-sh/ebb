import { check } from "../../src/index.js";

export interface EvalTask {
  id: string;
  category: string;
  ecosystem: string;
  prompt: string;
  baselinePick: {
    purl: string;
    version: string;
    rationale: string;
  };
  modernPick: {
    purl: string;
    version: string;
    rationale: string;
  };
  replacement: string;
}

export interface PickEvaluation {
  taskId: string;
  purl: string;
  version: string;
  status: string;
  isDeprecatedOrEol: boolean;
  replacement: string | null;
  ruleId: string | null;
}

export interface EvalRunScore {
  agent: string;
  mode: "baseline" | "mcp" | "skill";
  totalTasks: number;
  deprecatedOrEolCount: number;
  supportedCount: number;
  deprecationRatePct: number;
  picks: PickEvaluation[];
}

export function evaluatePick(taskId: string, purl: string, version: string): PickEvaluation {
  const result = check(purl, version);
  const isDeprecatedOrEol = result.status !== "ok";
  const firstMatch = result.matches?.[0] ?? null;

  return {
    taskId,
    purl,
    version,
    status: result.status,
    isDeprecatedOrEol,
    replacement: firstMatch?.replacement ?? null,
    ruleId: firstMatch?.ruleId ?? null,
  };
}

export function computeScore(agent: string, mode: "baseline" | "mcp" | "skill", picks: PickEvaluation[]): EvalRunScore {
  const totalTasks = picks.length;
  const deprecatedOrEolCount = picks.filter((p) => p.isDeprecatedOrEol).length;
  const supportedCount = totalTasks - deprecatedOrEolCount;
  const deprecationRatePct = totalTasks === 0 ? 0 : Math.round((deprecatedOrEolCount / totalTasks) * 1000) / 10;

  return {
    agent,
    mode,
    totalTasks,
    deprecatedOrEolCount,
    supportedCount,
    deprecationRatePct,
    picks,
  };
}
