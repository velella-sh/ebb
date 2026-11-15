import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { McpServer } from "../../src/mcp/index.js";

const require = createRequire(import.meta.url);

describe("MCP server.json registry manifest", () => {
  const manifestPath = resolve(process.cwd(), "server.json");
  const schemaPath = resolve(process.cwd(), "schemas/vendor/mcp-server.schema.json");
  const pkgPath = resolve(process.cwd(), "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    name: string;
    version: string;
    description: string;
    packages: Array<{
      registryType: string;
      identifier: string;
      version: string;
      packageArguments?: Array<{ type: string; value?: string }>;
      transport: { type: string };
    }>;
    _meta?: {
      "io.modelcontextprotocol.registry/publisher-provided"?: {
        tools?: string[];
      };
    };
  };
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    name: string;
    version: string;
    mcpName?: string;
  };
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const publisherMeta = manifest._meta?.["io.modelcontextprotocol.registry/publisher-provided"];

  it("matches package version, mcpName, and npm stdio package with mcp arg", () => {
    assert.equal(pkg.mcpName, manifest.name);
    assert.equal(manifest.version, pkg.version);
    assert.equal(manifest.name, "io.github.velella-sh/ebb");
    assert.ok(manifest.description.length <= 100);

    assert.equal(manifest.packages.length, 1);
    const npmPkg = manifest.packages[0]!;
    assert.equal(npmPkg.registryType, "npm");
    assert.equal(npmPkg.identifier, "@velella/ebb");
    assert.equal(npmPkg.version, pkg.version);
    assert.equal(npmPkg.transport.type, "stdio");
    assert.ok(npmPkg.packageArguments?.some((a) => a.type === "positional" && a.value === "mcp"));
  });

  it("validates against the vendored MCP server schema without fetching", () => {
    const AjvModule = require("ajv") as {
      default?: new (opts?: object) => { compile: (s: unknown) => (data: unknown) => boolean; errors?: unknown };
    };
    const Ajv =
      AjvModule.default ??
      (AjvModule as unknown as new (
        opts?: object,
      ) => { compile: (s: unknown) => (data: unknown) => boolean; errors?: unknown });
    const ajv = new Ajv({ strict: false, validateFormats: false });
    const validate = ajv.compile(schema);
    const ok = validate(manifest);
    assert.equal(
      ok,
      true,
      `schema errors: ${JSON.stringify(ajv.errors ?? (validate as { errors?: unknown }).errors, null, 2)}`,
    );
  });

  it("lists tools in publisher-provided metadata exactly equal to tools/list", async () => {
    assert.ok(publisherMeta?.tools, "server.json must declare tools under publisher-provided _meta");
    const declared = [...publisherMeta.tools].sort();

    const server = new McpServer();
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });
    const runtimeTools = (resp?.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name).sort();
    assert.deepEqual(
      declared,
      runtimeTools,
      `manifest tools ${JSON.stringify(declared)} must equal tools/list ${JSON.stringify(runtimeTools)}`,
    );
  });

  it("fails the equality check when a tool name differs", async () => {
    const server = new McpServer();
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });
    const runtimeTools = (resp?.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name).sort();
    const drifted = [...runtimeTools, "not-a-real-tool"].sort();
    assert.notDeepEqual(drifted, runtimeTools);
  });
});
