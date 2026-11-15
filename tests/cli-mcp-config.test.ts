import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MCP_PRINT_CONFIG_AGENTS, getMcpAgentConfig, printMcpConfig } from "../src/cli/mcp-config.js";
import { runCli } from "../src/cli.js";

function createIo() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout: {
        write(str: string) {
          stdout += str;
          return true;
        },
      },
      stderr: {
        write(str: string) {
          stderr += str;
          return true;
        },
      },
    },
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
  };
}

describe("ebb mcp --print-config", () => {
  it("prints Path + official snippet for every supported agent using npx -y @velella/ebb mcp", () => {
    for (const agent of MCP_PRINT_CONFIG_AGENTS) {
      const snippet = printMcpConfig(agent);
      const cfg = getMcpAgentConfig(agent);
      assert.match(snippet, /^Path: /);
      assert.ok(snippet.startsWith(`Path: ${cfg.path}\n`));
      assert.match(snippet, /npx/);
      assert.match(snippet, /@velella\/ebb/);
      assert.match(snippet, /\bmcp\b/);
      assert.ok(!snippet.includes("@velella/" + ["ebb", "mcp"].join("-")));
      assert.ok(cfg.path.length > 0);
    }

    // Zed uses the flat command/args shape from current Zed docs.
    assert.match(printMcpConfig("zed"), /"command": "npx"/);
    assert.ok(!printMcpConfig("zed").includes('"path": "npx"'));
  });

  it("writes the snippet through the CLI without starting stdio", async () => {
    const mock = createIo();
    const code = await runCli(["mcp", "--print-config", "cursor"], mock.io);
    assert.equal(code, 0);
    assert.equal(mock.stderr, "");
    assert.equal(mock.stdout, printMcpConfig("cursor"));
  });

  it("rejects unknown agents", async () => {
    const mock = createIo();
    const code = await runCli(["mcp", "--print-config", "not-an-agent"], mock.io);
    assert.equal(code, 2);
    assert.match(mock.stderr, /Unsupported agent/);
  });
});
