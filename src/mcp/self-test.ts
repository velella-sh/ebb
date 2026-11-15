import { dataStatus } from "../data-status.js";
import { VERSION } from "../version.js";
import { McpServer } from "./server.js";

export interface McpSelfTestResult {
  ok: boolean;
  line: string;
  error?: string | undefined;
}

const KNOWN_PURL = "pkg:npm/request@2.88.2";

/**
 * Load lifecycle data and run one known check through the MCP tool handler.
 * Does not start the stdio loop.
 */
export async function runMcpSelfTest(): Promise<McpSelfTestResult> {
  try {
    const status = dataStatus();
    const server = new McpServer({ name: "@velella/ebb", version: VERSION });
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "check",
        arguments: { purl: KNOWN_PURL },
      },
    });

    if (!resp || resp.error) {
      const message = resp?.error?.message ?? "no response from check tool";
      return { ok: false, line: "", error: `self-test failed: ${message}` };
    }

    const isError = Boolean((resp.result as { isError?: boolean } | undefined)?.isError);
    if (isError) {
      const text = (resp.result as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? "tool error";
      return { ok: false, line: "", error: `self-test failed: ${text}` };
    }

    const text = (resp.result as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? "";
    let payload: { status?: string };
    try {
      payload = JSON.parse(text) as { status?: string };
    } catch {
      // Text-formatted answers still include the status word.
      if (!/\bdeprecated\b/i.test(text)) {
        return {
          ok: false,
          line: "",
          error: `self-test check failed: expected status "deprecated", got unparseable answer`,
        };
      }
      payload = { status: "deprecated" };
    }

    if (payload.status !== "deprecated") {
      return {
        ok: false,
        line: "",
        error: `self-test check failed: expected status "deprecated", got "${payload.status ?? "unknown"}"`,
      };
    }

    const line = `ebb mcp self-test ok (@velella/ebb ${VERSION}, data ${status.version})`;
    return { ok: true, line };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, line: "", error: `self-test failed: ${message}` };
  }
}
