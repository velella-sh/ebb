import { check } from "../index.js";
import { dataStatus } from "../data-status.js";
import { VERSION } from "../version.js";

export interface McpSelfTestResult {
  ok: boolean;
  line: string;
  error?: string | undefined;
}

/**
 * Load lifecycle data and run one known check. Does not start the stdio loop.
 */
export function runMcpSelfTest(): McpSelfTestResult {
  try {
    const status = dataStatus();
    const result = check("pkg:npm/request", "2.88.2");
    if (result.status !== "deprecated") {
      return {
        ok: false,
        line: "",
        error: `self-test check failed: expected status "deprecated", got "${result.status}"`,
      };
    }
    const line = `ebb mcp self-test ok (@velella/ebb ${VERSION}, data ${status.version})`;
    return { ok: true, line };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, line: "", error: `self-test failed: ${message}` };
  }
}
