import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { McpServer } from "../src/index.js";
import { normalizeBatchItems } from "../src/tools/check_all.js";
import type { McpToolResult } from "../src/types.js";

describe("normalizeBatchItems", () => {
  it("normalizes array of PURL strings", () => {
    const items = normalizeBatchItems(["pkg:npm/request@2.88.2", "node@18.0.0", "pkg:npm/unknown"]);
    assert.equal(items.length, 3);
    assert.deepEqual(items[0], { purl: "pkg:npm/request", version: "2.88.2" });
    assert.deepEqual(items[1], { purl: "node@18.0.0", version: "" });
    assert.deepEqual(items[2], { purl: "pkg:npm/unknown", version: "" });
  });

  it("normalizes array of objects", () => {
    const items = normalizeBatchItems([
      { purl: "pkg:npm/request", version: "2.88.2" },
      { purl: "node", version: "18.0.0" },
    ]);
    assert.equal(items.length, 2);
    assert.deepEqual(items[0], { purl: "pkg:npm/request", version: "2.88.2" });
    assert.deepEqual(items[1], { purl: "node", version: "18.0.0" });
  });

  it("handles non-array inputs gracefully", () => {
    assert.deepEqual(normalizeBatchItems(null), []);
    assert.deepEqual(normalizeBatchItems(undefined), []);
    assert.deepEqual(normalizeBatchItems("pkg:npm/request"), []);
  });
});

describe("MCP check_all tool", () => {
  const server = new McpServer();

  it("lists check_all tool in tools/list", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });

    assert.ok(resp);
    const result = resp.result as { tools: Array<{ name: string; description: string }> };
    assert.ok(Array.isArray(result.tools));
    const checkAllDef = result.tools.find((t) => t.name === "check_all");
    assert.ok(checkAllDef);
    assert.equal(checkAllDef.name, "check_all");
  });

  it("checks batch of PURL strings preserving order and summary", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "check_all",
        arguments: {
          purls: ["pkg:npm/request@2.88.2", "pkg:npm/left-pad@1.3.0"],
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, false);
    const parsed = JSON.parse(toolResult.content[0]?.text ?? "{}");

    assert.ok(Array.isArray(parsed.results));
    assert.equal(parsed.results.length, 2);
    assert.equal(parsed.results[0].status, "deprecated");
    assert.equal(parsed.results[1].status, "deprecated");
    assert.equal(parsed.summary.total, 2);
    assert.equal(parsed.summary.byStatus.deprecated, 2);
  });

  it("checks batch of objects with purl and version", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "check_all",
        arguments: {
          purls: [
            { purl: "pkg:npm/request", version: "2.88.2" },
            { purl: "node", version: "14.0.0" },
          ],
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, false);
    const parsed = JSON.parse(toolResult.content[0]?.text ?? "{}");

    assert.equal(parsed.results.length, 2);
    assert.equal(parsed.results[0].status, "deprecated");
    assert.equal(parsed.results[1].status, "end-of-life");
    assert.equal(parsed.summary.total, 2);
    assert.equal(parsed.summary.byStatus.deprecated, 1);
    assert.equal(parsed.summary.byStatus["end-of-life"], 1);
  });

  it("handles items with missing version as positional errors without failing batch", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "check_all",
        arguments: {
          purls: ["pkg:npm/request@2.88.2", "pkg:npm/request"],
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, false);
    const parsed = JSON.parse(toolResult.content[0]?.text ?? "{}");

    assert.equal(parsed.results.length, 2);
    assert.equal(parsed.results[0].status, "deprecated");
    assert.equal(parsed.results[1].status, "error");
    assert.equal(parsed.results[1].index, 1);
    assert.equal(parsed.summary.total, 2);
    assert.equal(parsed.summary.errors, 1);
  });

  it("handles empty batch array cleanly", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "check_all",
        arguments: {
          purls: [],
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, false);
    const parsed = JSON.parse(toolResult.content[0]?.text ?? "{}");

    assert.deepEqual(parsed.results, []);
    assert.equal(parsed.summary.total, 0);
    assert.equal(parsed.summary.errors, 0);
  });

  it("returns error when purls argument is missing or not an array", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "check_all",
        arguments: {
          purls: "not-an-array",
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, true);
    assert.ok(toolResult.content[0]?.text.includes("'purls' parameter is required"));
  });
});
