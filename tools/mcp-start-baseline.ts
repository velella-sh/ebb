/** Median cold-start baseline (ms) captured for mcp-setup-7 on Apple M-series / Node 22. */
export const MCP_START_BASELINE_MEDIAN_MS = 50;
export const MCP_START_REGRESSION_THRESHOLD = 0.2;
/** CI runners are slower; keep a separate ceiling so `npm test` does not flake. */
export const MCP_START_CI_CEILING_MS = 500;

export interface McpStartStats {
  medianMs: number;
}

export function assertWithinBaseline(
  stats: McpStartStats,
  baselineMedianMs = MCP_START_BASELINE_MEDIAN_MS,
  threshold = MCP_START_REGRESSION_THRESHOLD,
): void {
  const limit = baselineMedianMs * (1 + threshold);
  if (stats.medianMs > limit) {
    throw new Error(
      `MCP cold-start regression: median ${stats.medianMs.toFixed(2)}ms exceeds baseline ${baselineMedianMs}ms by more than ${threshold * 100}% (limit ${limit.toFixed(2)}ms)`,
    );
  }
}
