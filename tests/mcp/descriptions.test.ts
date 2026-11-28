import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { McpServer } from "../../src/mcp/index.js";

const EXPECTED_SNAPSHOT: Record<string, string> = {
  check:
    'Call before installing or upgrading a package or runtime version. Checks against known end-of-life and deprecation dates. Example: {"purl":"pkg:npm/request@2.88.2"}.',
  check_all:
    'Call before installing or auditing multiple packages or dependencies in batch. Checks each against known end-of-life and deprecation dates. Example: {"items":["pkg:npm/request@2.88.2","node@18.0.0"]}.',
  check_install:
    'Call before running an install command. Parses package manager commands (npm, pnpm, yarn, bun, pip, cargo, go) and checks every package against lifecycle rules. Example: {"command":"npm install request@2.88.2"}.',
  diff: 'Call to compare two lifecycle data versions, dates, files, or active data and inspect added, changed, or removed rules. Example: {"from":"2026.10.01","to":"active"}.',
  pick_version:
    'Call before choosing a runtime or a major version. Returns known release lines, the recommended line, and whether coverage is complete. Example: {"purl":"node","as_of":"2026-11-15"}.',
  predict_eol:
    'Call when an unannounced end-of-life date needs a planning estimate. Returns a predicted range, confidence and sources. Example: {"purl":"pkg:generic/golang","version":"1.26.0"}.',
  replacement_for:
    'Call when a component is deprecated or end-of-life to find recommended migration targets or alternatives. Example: {"purl":"pkg:npm/request","version":"2.88.2"}.',
  runtime_support:
    'Call to find the first known framework version compatible with a runtime, or to check a specific release. Example: {"purl":"pkg:pypi/django","runtimePurl":"pkg:generic/python","runtimeVersion":"3.13"}.',
  sources_of:
    'Call to inspect authoritative sources, archive snapshot URLs, health status, and review provenance for a lifecycle rule. Example: {"ruleId":"npm.package.request.deprecated"}.',
  upcoming:
    'Call before planning upgrades to list scheduled deprecation and end-of-life deadlines within a time window. Example: {"within":"90d","ecosystem":"npm"}.',
};

describe("MCP tool descriptions", () => {
  const server = new McpServer();

  it("every tool description says when to call it, contains an example, and is under 400 characters", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });

    assert.ok(resp && resp.result);
    const tools = (resp.result as { tools: Array<{ name: string; description: string }> }).tools;

    for (const tool of tools) {
      assert.ok(
        tool.description.startsWith("Call "),
        `Tool "${tool.name}" description must state when to call it (start with 'Call ...'): got "${tool.description}"`,
      );
      assert.ok(
        tool.description.includes("Example:"),
        `Tool "${tool.name}" description must contain an example input: got "${tool.description}"`,
      );
      assert.ok(
        tool.description.length < 400,
        `Tool "${tool.name}" description must be under 400 characters: got ${tool.description.length} chars`,
      );
    }
  });

  it("snapshot test passes: runtime tool descriptions match the golden snapshot", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });

    assert.ok(resp && resp.result);
    const tools = (resp.result as { tools: Array<{ name: string; description: string }> }).tools;

    const runtimeMap: Record<string, string> = {};
    for (const tool of tools) {
      runtimeMap[tool.name] = tool.description;
    }

    assert.deepEqual(runtimeMap, EXPECTED_SNAPSHOT);
  });

  it("server.json has the same descriptions as the code", () => {
    const manifestPath = resolve(process.cwd(), "server.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      _meta?: {
        "io.modelcontextprotocol.registry/publisher-provided"?: {
          toolDescriptions?: Record<string, string>;
        };
      };
    };

    const declaredDescriptions =
      manifest._meta?.["io.modelcontextprotocol.registry/publisher-provided"]?.toolDescriptions;
    assert.ok(declaredDescriptions, "server.json must have toolDescriptions in _meta");
    assert.deepEqual(declaredDescriptions, EXPECTED_SNAPSHOT);
  });
});
