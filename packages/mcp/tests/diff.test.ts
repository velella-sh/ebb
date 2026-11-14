import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { McpServer } from "../src/index.js";
import type { McpToolResult } from "../src/types.js";

describe("MCP diff tool", () => {
  const server = new McpServer();

  it("lists diff in tools/list", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });
    assert.ok(resp);
    const result = resp.result as { tools: Array<{ name: string }> };
    assert.ok(result.tools.some((t) => t.name === "diff"));
  });

  it("runs diff between bundled and active via tools/call (markdown)", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "diff",
        arguments: {
          from: "bundled",
          to: "active",
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, false);
    assert.ok(toolResult.content[0]?.text.includes("# Ebb Lifecycle Data Diff"));
  });

  it("runs diff returning json format", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "diff",
        arguments: {
          from: "bundled",
          to: "active",
          format: "json",
          ecosystem: "npm",
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, false);
    const parsed = JSON.parse(toolResult.content[0]?.text ?? "{}");
    assert.equal(parsed.schemaVersion, "ebb.data-diff.v1");
    assert.ok(parsed.summary);
  });

  it("returns error for invalid target", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "diff",
        arguments: {
          from: "nonexistent-version-xyz",
          to: "active",
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, true);
    assert.ok(toolResult.content[0]?.text.includes("Error:"));
  });
});
