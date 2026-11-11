import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { McpServer } from "../src/index.js";
import { extractPurlAndVersion } from "../src/tools/check.js";
import type { McpToolResult } from "../src/types.js";

describe("extractPurlAndVersion", () => {
  it("extracts version from PURL string", () => {
    const res = extractPurlAndVersion("pkg:npm/request@2.88.2");
    assert.equal(res.purl, "pkg:npm/request");
    assert.equal(res.version, "2.88.2");
  });

  it("prioritizes explicit version argument", () => {
    const res = extractPurlAndVersion("pkg:npm/request@1.0.0", "2.88.2");
    assert.equal(res.purl, "pkg:npm/request");
    assert.equal(res.version, "2.88.2");
  });

  it("handles purl without version", () => {
    const res = extractPurlAndVersion("pkg:npm/request");
    assert.equal(res.purl, "pkg:npm/request");
    assert.equal(res.version, undefined);
  });

  it("handles bare product name", () => {
    const res = extractPurlAndVersion("node", "18.0.0");
    assert.equal(res.purl, "node");
    assert.equal(res.version, "18.0.0");
  });
});

describe("MCP check tool", () => {
  const server = new McpServer();

  it("lists check tool in tools/list", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });

    assert.ok(resp);
    const result = resp.result as { tools: Array<{ name: string; description: string }> };
    assert.ok(Array.isArray(result.tools));
    const checkToolDef = result.tools.find((t) => t.name === "check");
    assert.ok(checkToolDef);
    assert.equal(checkToolDef.name, "check");
    assert.ok(checkToolDef.description.length > 0);
  });

  it("checks deprecated npm package when version is in purl", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "check",
        arguments: {
          purl: "pkg:npm/request@2.88.2",
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, false);
    assert.equal(toolResult.content.length, 1);
    assert.equal(toolResult.content[0]?.type, "text");

    const parsed = JSON.parse(toolResult.content[0]?.text ?? "{}");
    assert.equal(parsed.status, "deprecated");
    assert.ok(Array.isArray(parsed.matches));
    assert.ok(parsed.matches.length > 0);
    assert.equal(parsed.version, "2.88.2");
  });

  it("checks package with separate purl and version arguments", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "check",
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
    assert.equal(parsed.status, "deprecated");
  });

  it("checks bare product name e.g. node 14.0.0", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "check",
        arguments: {
          purl: "node",
          version: "14.0.0",
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, false);
    const parsed = JSON.parse(toolResult.content[0]?.text ?? "{}");
    assert.equal(parsed.status, "end-of-life");
  });

  it("returns status ok for unknown package with no rules", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "check",
        arguments: {
          purl: "pkg:npm/definitely-unknown-pkg-404@1.0.0",
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, false);
    const parsed = JSON.parse(toolResult.content[0]?.text ?? "{}");
    assert.equal(parsed.status, "ok");
    assert.deepEqual(parsed.matches, []);
  });

  it("supports asOf date to calculate countdown", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "check",
        arguments: {
          purl: "pkg:npm/request@2.88.2",
          asOf: "2026-11-11",
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, false);
    const parsed = JSON.parse(toolResult.content[0]?.text ?? "{}");
    assert.equal(parsed.status, "deprecated");
    assert.equal(parsed.asOf, "2026-11-11");
  });

  it("returns error when purl is missing or empty", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "check",
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
      id: 8,
      method: "tools/call",
      params: {
        name: "check",
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

  it("returns error on call to unknown tool", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "unknown_nonexistent_tool",
        arguments: {},
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, true);
    assert.ok(toolResult.content[0]?.text.includes("Unknown tool"));
  });
});
