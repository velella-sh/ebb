import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { McpServer } from "../../src/mcp/index.js";
import type { McpToolDefinition, McpToolResult } from "../../src/mcp/types.js";

const require = createRequire(import.meta.url);
// biome-ignore lint/suspicious/noExplicitAny: dynamic import of ajv
const AjvModule = require("ajv") as any;
const Ajv = AjvModule.default ?? AjvModule;
const ajv = new Ajv({ strict: false, validateFormats: false });

describe("MCP tool structured output and outputSchema validation", () => {
  const server = new McpServer();

  it("every registered tool declares an outputSchema", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });

    assert.ok(resp && resp.result);
    const tools = (resp.result as { tools: McpToolDefinition[] }).tools;
    assert.equal(tools.length, 9);

    for (const tool of tools) {
      assert.ok(tool.outputSchema, `Tool "${tool.name}" must declare an outputSchema in its tool definition`);
      assert.equal(tool.outputSchema.type, "object", `Tool "${tool.name}" outputSchema must be of type object`);
    }
  });

  const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = [
    { name: "check", args: { purl: "pkg:npm/request@2.88.2" } },
    { name: "check_all", args: { items: ["pkg:npm/request@2.88.2"] } },
    { name: "check_install", args: { command: "npm install request@2.88.2" } },
    { name: "diff", args: { from: "bundled", to: "active", format: "json" } },
    { name: "pick_version", args: { purl: "node", as_of: "2026-11-15" } },
    { name: "predict_eol", args: { purl: "pkg:generic/golang", version: "1.26.0" } },
    { name: "replacement_for", args: { purl: "pkg:npm/request", version: "2.88.2" } },
    { name: "sources_of", args: { ruleId: "npm.package.request.deprecated" } },
    { name: "upcoming", args: { as_of: "2026-01-01" } },
  ];

  for (const { name, args } of toolCalls) {
    it(`validates structuredContent of tool "${name}" against its declared outputSchema`, async () => {
      const listResp = await server.handleMessage({
        jsonrpc: "2.0",
        id: `list-${name}`,
        method: "tools/list",
      });
      const tools = (listResp?.result as { tools: McpToolDefinition[] }).tools;
      const toolDef = tools.find((t) => t.name === name);
      assert.ok(toolDef && toolDef.outputSchema);

      const validate = ajv.compile(toolDef.outputSchema);

      const callResp = await server.handleMessage({
        jsonrpc: "2.0",
        id: `call-${name}`,
        method: "tools/call",
        params: { name, arguments: args },
      });

      assert.ok(callResp && callResp.result);
      const toolResult = callResp.result as McpToolResult;
      assert.equal(toolResult.isError, false);

      // 1. Text output must be preserved for older clients
      assert.ok(toolResult.content.length > 0);
      assert.equal(toolResult.content[0]?.type, "text");
      assert.ok((toolResult.content[0]?.text.length ?? 0) > 0);

      // 2. Structured content must be returned
      assert.ok(toolResult.structuredContent, `Tool "${name}" must return structuredContent next to text content`);

      // 3. Structured content must validate against declared outputSchema
      const valid = validate(toolResult.structuredContent);
      assert.equal(
        valid,
        true,
        `Tool "${name}" structured output failed validation: ${JSON.stringify(validate.errors, null, 2)}`,
      );
    });
  }
});
