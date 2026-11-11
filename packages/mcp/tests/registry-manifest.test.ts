import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { McpServer } from "../src/index.js";

describe("MCP server.json registry manifest", () => {
  const manifestPath = fileURLToPath(new URL("../../server.json", import.meta.url));
  const rawContent = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(rawContent);
  const server = new McpServer();

  it("conforms to standard MCP server manifest structure", () => {
    assert.equal(manifest.name, "@velella/ebb-mcp");
    assert.equal(manifest.version, "0.1.0");
    assert.ok(typeof manifest.description === "string" && manifest.description.length > 0);
    assert.equal(manifest.license, "MIT");
    assert.ok(manifest.homepage);
    assert.ok(manifest.repository);
  });

  it("configures stdio transport for agent execution", () => {
    assert.ok(manifest.transport);
    assert.equal(manifest.transport.type, "stdio");
    assert.ok(manifest.transport.command);
    assert.ok(Array.isArray(manifest.transport.args));
  });

  it("lists all registered tools with valid input schemas", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });

    const runtimeTools = (resp?.result as { tools: Array<{ name: string }> }).tools;
    const manifestTools = manifest.tools as Array<{ name: string; inputSchema: { type: string } }>;

    assert.ok(Array.isArray(manifestTools));
    assert.equal(manifestTools.length, runtimeTools.length);

    for (const rt of runtimeTools) {
      const match = manifestTools.find((t) => t.name === rt.name);
      assert.ok(match, `Tool ${rt.name} missing in server.json`);
      assert.equal(match.inputSchema.type, "object");
    }
  });

  it("lists all registered resources", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "resources/list",
    });

    const runtimeResources = (resp?.result as { resources: Array<{ uri: string }> }).resources;
    const manifestResources = manifest.resources as Array<{ uri: string }>;

    assert.ok(Array.isArray(manifestResources));
    for (const rr of runtimeResources) {
      const match = manifestResources.find((r) => r.uri === rr.uri);
      assert.ok(match, `Resource ${rr.uri} missing in server.json`);
    }
  });
});
