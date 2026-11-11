import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { McpServer } from "../src/index.js";
import type { McpToolResult } from "../src/types.js";

describe("MCP provenance (sources and reviewer)", () => {
  const server = new McpServer();

  it("check tool includes source URLs and reviewer in matches and root provenance", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
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
    const parsed = JSON.parse(toolResult.content[0]?.text ?? "{}");

    assert.equal(parsed.status, "deprecated");
    assert.ok(parsed.matches.length > 0);

    const firstMatch = parsed.matches[0];
    assert.ok(firstMatch);
    assert.ok(firstMatch.reviewer, "Expected reviewer to be defined on match");
    assert.equal(firstMatch.reviewer, "arminazimi");
    assert.ok(Array.isArray(firstMatch.sources));
    assert.ok(firstMatch.sources.length > 0);
    assert.ok(firstMatch.sources[0].url.startsWith("https://"));

    assert.ok(parsed.provenance);
    assert.ok(Array.isArray(parsed.provenance.sources));
    assert.ok(parsed.provenance.sources.length > 0);
    assert.ok(parsed.provenance.sources.some((s: string) => s.includes("npmjs.com/package/request")));
    assert.ok(Array.isArray(parsed.provenance.reviewers));
    assert.ok(parsed.provenance.reviewers.includes("arminazimi"));
  });

  it("check_all tool includes sources and reviewers across batch", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "check_all",
        arguments: {
          purls: ["pkg:npm/request@2.88.2", "node@14.0.0"],
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, false);
    const parsed = JSON.parse(toolResult.content[0]?.text ?? "{}");

    assert.ok(Array.isArray(parsed.results));
    assert.equal(parsed.results.length, 2);

    assert.ok(parsed.provenance);
    assert.ok(Array.isArray(parsed.provenance.sources));
    assert.ok(parsed.provenance.sources.length > 0);
    assert.ok(Array.isArray(parsed.provenance.reviewers));
    assert.ok(parsed.provenance.reviewers.includes("arminazimi"));
  });

  it("returns empty sources and reviewers when no rules match", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "check",
        arguments: {
          purl: "pkg:npm/definitely-unknown-404@1.0.0",
        },
      },
    });

    assert.ok(resp);
    const toolResult = resp.result as McpToolResult;
    assert.equal(toolResult.isError, false);
    const parsed = JSON.parse(toolResult.content[0]?.text ?? "{}");

    assert.equal(parsed.status, "ok");
    assert.deepEqual(parsed.matches, []);
    assert.deepEqual(parsed.provenance.sources, []);
    assert.deepEqual(parsed.provenance.reviewers, []);
  });
});
