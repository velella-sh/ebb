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

export interface McpAgentConfig {
  /** Where to put the snippet: a config file path, or a CLI command scope. */
  path: string;
  /** Exact config body or CLI command to run. */
  snippet: string;
}

function isAgent(value: string): value is McpPrintConfigAgent {
  return (MCP_PRINT_CONFIG_AGENTS as readonly string[]).includes(value);
}

function formatOutput(path: string, snippet: string): string {
  const body = snippet.endsWith("\n") ? snippet : `${snippet}\n`;
  return `Path: ${path}\n${body}`;
}

/**
 * Returns agent-specific install guidance for `npx -y @velella/ebb mcp`.
 * Does not write any user config files.
 */
export function getMcpAgentConfig(agent: string): McpAgentConfig {
  if (!isAgent(agent)) {
    throw new Error(`Unsupported agent "${agent}". Expected one of: ${MCP_PRINT_CONFIG_AGENTS.join(", ")}.`);
  }

  switch (agent) {
    case "claude-code":
      return {
        path: "claude CLI (`claude mcp add`)",
        snippet: "claude mcp add ebb -- npx -y @velella/ebb mcp\n",
      };
    case "gemini":
      return {
        path: "gemini CLI (`gemini mcp add`)",
        snippet: "gemini mcp add ebb -- npx -y @velella/ebb mcp\n",
      };
    case "cursor":
      return {
        path: "~/.cursor/mcp.json (or project .cursor/mcp.json)",
        snippet: `${JSON.stringify(
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
        )}\n`,
      };
    case "codex":
      return {
        path: "~/.codex/config.toml",
        snippet: `${["[mcp_servers.ebb]", 'command = "npx"', `args = ${JSON.stringify([...NPX_ARGS])}`].join("\n")}\n`,
      };
    case "vscode":
      return {
        path: ".vscode/mcp.json",
        snippet: `${JSON.stringify(
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
        )}\n`,
      };
    case "windsurf":
      return {
        path: "~/.codeium/windsurf/mcp_config.json",
        snippet: `${JSON.stringify(
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
        )}\n`,
      };
    case "zed":
      // Zed settings use flat command/args (see https://zed.dev/docs/ai/mcp).
      return {
        path: "Zed settings.json (`context_servers`; open via `zed: open settings file`)",
        snippet: `${JSON.stringify(
          {
            context_servers: {
              ebb: {
                command: "npx",
                args: [...NPX_ARGS],
                env: {},
              },
            },
          },
          null,
          2,
        )}\n`,
      };
  }
}

/**
 * Prints the agent-specific config snippet that runs `npx -y @velella/ebb mcp`.
 * Prefixed with `Path:` so docs and agents know where to paste it.
 */
export function printMcpConfig(agent: string): string {
  const config = getMcpAgentConfig(agent);
  return formatOutput(config.path, config.snippet);
}
