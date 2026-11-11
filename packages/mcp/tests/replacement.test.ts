import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { McpServer } from "../src/index.js";
import type { McpToolResult } from "../src/types.js";

describe("MCP replacement_for tool", () => {
  const server = new McpServer();

  it("lists replacement_for tool in tools/list", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });

    assert.ok(resp);
    const result = resp.result as { tools: Array<{ name: string; description: string }> };
    assert.ok(Array.isArray(result.tools));
    const repToolDef = result.tools.find((t) => t.name === "replacement_for");
    assert.ok(repToolDef);
    assert.equal(repToolDef.name, "replacement_for");
  });

  it("returns replacement recommendation when embedded version in purl", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "replacement_for",
        arguments: {
          purl: "pkg:npm/request@2.88.2",
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, false);
    const parsed = JSON.parse(toolResult.content[0]?.text ?? "{}");
    assert.equal(parsed.purl, "pkg:npm/request");
    assert.equal(parsed.version, "2.88.2");
    assert.ok(typeof parsed.replacement === "string" && parsed.replacement.length > 0);
  });

  it("returns replacement recommendation when separate purl and version arguments", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "replacement_for",
        arguments: {
          purl: "pkg:npm/request",
          version: "2.88.2",
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, false);
    const parsed = JSON.parse(toolResult.content[0]?.text ?? "{}");
    assert.ok(parsed.replacement);
  });

  it("returns null replacement for package with no replacement", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "replacement_for",
        arguments: {
          purl: "pkg:npm/unknown-package-with-no-rules@1.0.0",
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, false);
    const parsed = JSON.parse(toolResult.content[0]?.text ?? "{}");
    assert.equal(parsed.replacement, null);
  });

  it("returns error when purl parameter is missing", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "replacement_for",
        arguments: {},
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, true);
    assert.ok(toolResult.content[0]?.text.includes("'purl' parameter is required"));
  });

  it("returns error when version is missing from both purl and arguments", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "replacement_for",
        arguments: {
          purl: "pkg:npm/request",
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, true);
    assert.ok(toolResult.content[0]?.text.includes("version is required"));
  });
});
