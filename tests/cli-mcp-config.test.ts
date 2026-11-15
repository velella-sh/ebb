import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MCP_PRINT_CONFIG_AGENTS, printMcpConfig } from "../src/cli/mcp-config.js";
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
  it("prints snapshots for every supported agent using npx -y @velella/ebb mcp", () => {
    const snapshots: Record<string, string> = {};
    for (const agent of MCP_PRINT_CONFIG_AGENTS) {
      const snippet = printMcpConfig(agent);
      assert.match(snippet, /npx/);
      assert.match(snippet, /@velella\/ebb/);
      assert.match(snippet, /\bmcp\b/);
      assert.ok(!snippet.includes("@velella/" + ["ebb", "mcp"].join("-")));
      snapshots[agent] = snippet;
    }

    assert.deepEqual(snapshots, {
      "claude-code": "claude mcp add ebb -- npx -y @velella/ebb mcp\n",
      gemini: "gemini mcp add ebb -- npx -y @velella/ebb mcp\n",
      cursor: `${JSON.stringify(
        {
          mcpServers: {
            ebb: {
              command: "npx",
              args: ["-y", "@velella/ebb", "mcp"],
            },
          },
        },
        null,
        2,
      )}\n`,
      codex: `[mcp_servers.ebb]\ncommand = "npx"\nargs = ${JSON.stringify(["-y", "@velella/ebb", "mcp"])}\n`,
      vscode: `${JSON.stringify(
        {
          servers: {
            ebb: {
              command: "npx",
              args: ["-y", "@velella/ebb", "mcp"],
            },
          },
        },
        null,
        2,
      )}\n`,
      windsurf: `${JSON.stringify(
        {
          mcpServers: {
            ebb: {
              command: "npx",
              args: ["-y", "@velella/ebb", "mcp"],
            },
          },
        },
        null,
        2,
      )}\n`,
      zed: `${JSON.stringify(
        {
          context_servers: {
            ebb: {
              command: {
                path: "npx",
                args: ["-y", "@velella/ebb", "mcp"],
              },
            },
          },
        },
        null,
        2,
      )}\n`,
    });
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
