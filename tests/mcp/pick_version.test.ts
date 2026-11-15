import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { McpServer } from "../../src/mcp/index.js";
import type { McpToolResult } from "../../src/mcp/types.js";

describe("MCP pick_version tool", () => {
  const server = new McpServer();

  async function call(args: Record<string, unknown>): Promise<McpToolResult> {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "pick_version", arguments: args },
    });
    assert.ok(resp);
    return resp.result as McpToolResult;
  }

  it("describes itself as the tool to call before choosing a runtime or major version", async () => {
    const resp = await server.handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    assert.ok(resp);
    const tools = (resp.result as { tools: Array<{ name: string; description: string }> }).tools;
    const tool = tools.find((entry) => entry.name === "pick_version");
    assert.ok(tool);
    assert.match(tool.description, /before choosing a runtime or a major version/i);
  });

  it("returns lines and a recommendation for a runtime", async () => {
    const result = await call({ purl: "node", as_of: "2026-11-15" });
    assert.equal(result.isError, false);
    const parsed = JSON.parse(result.content[0]?.text ?? "{}") as {
      summary: string;
      complete: boolean;
      recommendation: { lineId: string };
      lines: Array<{ id: string }>;
    };
    assert.match(parsed.summary, /26\.x/);
    assert.equal(parsed.recommendation.lineId, "26.x");
    assert.equal(parsed.complete, true);
    assert.ok(parsed.lines.some((line) => line.id === "22.x"));
  });

  it("returns no recommendation for a package whose line has ended", async () => {
    const result = await call({ purl: "pkg:npm/request", as_of: "2026-11-15" });
    assert.equal(result.isError, false);
    const parsed = JSON.parse(result.content[0]?.text ?? "{}") as {
      recommendation: null;
      lines: Array<{ id: string }>;
    };
    assert.equal(parsed.recommendation, null);
    assert.equal(parsed.lines[0]?.id, "*");
  });

  it("returns an empty answer for an unknown component", async () => {
    const result = await call({ purl: "pkg:npm/not-a-real-ebb-package", as_of: "2026-11-15" });
    assert.equal(result.isError, false);
    const parsed = JSON.parse(result.content[0]?.text ?? "{}") as { lines: unknown[]; complete: boolean };
    assert.deepEqual(parsed.lines, []);
    assert.equal(parsed.complete, false);
  });
});
