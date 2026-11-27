import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { McpServer } from "../../src/mcp/index.js";
import type { McpToolResult } from "../../src/mcp/types.js";

describe("MCP separate no rule known from supported", () => {
  const server = new McpServer();

  it("answers differently for a known supported version and an unknown package", async () => {
    // 1. Known supported version: Node 28.0.0 (Node has rules, 28.0.0 is healthy/supported)
    const supportedResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "check",
        arguments: {
          purl: "node",
          version: "28.0.0",
        },
      },
    });

    assert.ok(supportedResp && supportedResp.result);
    const supportedResult = supportedResp.result as McpToolResult;
    assert.equal(supportedResult.isError, false);
    const supportedStructured = supportedResult.structuredContent as Record<string, unknown>;
    assert.equal(supportedStructured.status, "ok");
    assert.equal(supportedStructured.message, undefined);

    // 2. Unknown package: definitely-not-a-real-ebb-package-12345
    const unknownResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "check",
        arguments: {
          purl: "pkg:npm/definitely-not-a-real-ebb-package-12345@1.0.0",
        },
      },
    });

    assert.ok(unknownResp && unknownResp.result);
    const unknownResult = unknownResp.result as McpToolResult;
    assert.equal(unknownResult.isError, false);

    // Structured content uses distinct status "unknown" and gives ecosystem coverage
    const unknownStructured = unknownResult.structuredContent as Record<string, unknown>;
    assert.equal(unknownStructured.status, "unknown");
    assert.ok(typeof unknownStructured.message === "string");
    assert.match(unknownStructured.message as string, /no rule for this component.*not proof of support/i);
    assert.equal(unknownStructured.ecosystem, "npm");
    assert.ok(typeof unknownStructured.ecosystemRules === "number");
    assert.ok((unknownStructured.ecosystemRules as number) > 0);

    // Text content says Ebb has no rule and that this is not proof of support
    const textContent = unknownResult.content[0]?.text ?? "";
    assert.match(textContent, /no rule for this component.*not proof of support/i);
    assert.match(textContent, /npm ecosystem/i);

    // Different statuses verified
    assert.notEqual(supportedStructured.status, unknownStructured.status);
  });
});
