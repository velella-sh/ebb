export const MCP_PRINT_CONFIG_AGENTS = [
  "claude-code",
  "cursor",
  "codex",
  "gemini",
  "vscode",
  "windsurf",
  "zed",
] as const;

export type McpPrintConfigAgent = (typeof MCP_PRINT_CONFIG_AGENTS)[number];

const NPX_ARGS = ["-y", "@velella/ebb", "mcp"] as const;

function isAgent(value: string): value is McpPrintConfigAgent {
  return (MCP_PRINT_CONFIG_AGENTS as readonly string[]).includes(value);
}

/**
 * Returns the agent-specific config snippet that runs `npx -y @velella/ebb mcp`.
 * Does not write any user config files.
 */
export function printMcpConfig(agent: string): string {
  if (!isAgent(agent)) {
    throw new Error(`Unsupported agent "${agent}". Expected one of: ${MCP_PRINT_CONFIG_AGENTS.join(", ")}.`);
  }

  switch (agent) {
    case "claude-code":
      return "claude mcp add ebb -- npx -y @velella/ebb mcp\n";
    case "gemini":
      return "gemini mcp add ebb -- npx -y @velella/ebb mcp\n";
    case "cursor":
      return `${JSON.stringify(
        {
          mcpServers: {
            ebb: {
              command: "npx",
              args: [...NPX_ARGS],
            },
          },
        },
        null,
        2,
      )}\n`;
    case "codex":
      return `${["[mcp_servers.ebb]", 'command = "npx"', `args = ${JSON.stringify([...NPX_ARGS])}`].join("\n")}\n`;
    case "vscode":
      return `${JSON.stringify(
        {
          servers: {
            ebb: {
              command: "npx",
              args: [...NPX_ARGS],
            },
          },
        },
        null,
        2,
      )}\n`;
    case "windsurf":
      return `${JSON.stringify(
        {
          mcpServers: {
            ebb: {
              command: "npx",
              args: [...NPX_ARGS],
            },
          },
        },
        null,
        2,
      )}\n`;
    case "zed":
      return `${JSON.stringify(
        {
          context_servers: {
            ebb: {
              command: {
                path: "npx",
                args: [...NPX_ARGS],
              },
            },
          },
        },
        null,
        2,
      )}\n`;
  }
}
