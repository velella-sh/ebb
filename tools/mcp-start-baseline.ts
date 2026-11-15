/** Median cold-start baseline (ms) captured locally for mcp-setup-7 on Apple M-series / Node 22. */
export const MCP_START_BASELINE_MEDIAN_MS = 50;

/**
 * Median cold-start baseline (ms) for GitHub Actions `ubuntu-latest` + Node 22.
 * Same runner class as `.github/workflows/bench.yml`. Measured from process start
 * to the JSON-RPC `initialize` answer of `ebb mcp`.
 */
export const MCP_START_CI_BASELINE_MEDIAN_MS = 100;

export const MCP_START_REGRESSION_THRESHOLD = 0.2;

/** Absolute safety ceiling so a hung process fails loudly. */
export const MCP_START_CI_CEILING_MS = 500;

export interface McpStartStats {
  medianMs: number;
}

export function regressionLimitMs(baselineMedianMs: number, threshold = MCP_START_REGRESSION_THRESHOLD): number {
  return baselineMedianMs * (1 + threshold);
}

export function assertWithinBaseline(
  stats: McpStartStats,
  baselineMedianMs = MCP_START_BASELINE_MEDIAN_MS,
  threshold = MCP_START_REGRESSION_THRESHOLD,
): void {
  const limit = regressionLimitMs(baselineMedianMs, threshold);
  if (stats.medianMs > limit) {
    throw new Error(
      `MCP cold-start regression: median ${stats.medianMs.toFixed(2)}ms exceeds baseline ${baselineMedianMs}ms by more than ${threshold * 100}% (limit ${limit.toFixed(2)}ms)`,
    );
  }
}

/** CI Benchmark job: compare against the ubuntu-latest baseline with a 20% gate. */
export function assertWithinCiBaseline(stats: McpStartStats): void {
  if (stats.medianMs > MCP_START_CI_CEILING_MS) {
    throw new Error(
      `MCP cold-start ${stats.medianMs.toFixed(2)}ms exceeds absolute CI ceiling ${MCP_START_CI_CEILING_MS}ms`,
    );
  }
  assertWithinBaseline(stats, MCP_START_CI_BASELINE_MEDIAN_MS, MCP_START_REGRESSION_THRESHOLD);
}
