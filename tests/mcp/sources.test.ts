import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { McpServer } from "../../src/mcp/index.js";
import type { McpToolResult } from "../../src/mcp/types.js";

describe("MCP sources_of tool", () => {
  const server = new McpServer();

  it("lists sources_of in tools/list", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });
    assert.ok(resp);
    const result = resp.result as { tools: Array<{ name: string }> };
    assert.ok(result.tools.some((t) => t.name === "sources_of"));
  });

  it("looks up sources for a rule via tools/call", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "sources_of",
        arguments: {
          ruleId: "npm.package.request.deprecated",
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, false);
    const parsed = JSON.parse(toolResult.content[0]?.text ?? "{}");

    assert.equal(parsed.ruleId, "npm.package.request.deprecated");
    assert.equal(parsed.ecosystem, "npm");
    assert.equal(parsed.reviewer, "arminazimi");
    assert.ok(Array.isArray(parsed.sources));
    assert.ok(parsed.sources.length > 0);
    assert.ok(parsed.sources[0].url);
    assert.ok(parsed.sources[0].health);
  });

  it("returns error for unknown ruleId", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "sources_of",
        arguments: {
          ruleId: "nonexistent.rule.id",
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, true);
    assert.ok(toolResult.content[0]?.text.includes("not found"));
  });

  it("returns error when ruleId is missing", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "sources_of",
        arguments: {},
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, true);
    assert.ok(toolResult.content[0]?.text.includes("Missing required parameter 'ruleId'"));
  });
});
