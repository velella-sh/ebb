---
title: "Model Context Protocol (MCP) server"
description: "Equip AI coding agents (Claude Code, Cursor, Codex, Gemini CLI) with lifecycle checks, deprecation alerts, and migration guidance via Ebb's official MCP server."
layout: doc
permalink: /mcp/
---

Ebb provides an official [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server under `@velella/ebb-mcp` that exposes lifecycle rules, deprecation advisories, migration recommendations, and upcoming deadlines directly to AI coding agents.

Before an agent chooses a runtime or suggests a library, it queries Ebb over standard stdio JSON-RPC 2.0 without making outbound network requests or installing unnecessary runtime dependencies.

## Agent setup

### Claude Code

Install the MCP server into Claude Code via the `claude mcp add` CLI command:

```bash
# Add to current workspace
claude mcp add ebb -- npx -y @velella/ebb-mcp

# Or add globally across all projects
claude mcp add -s global ebb -- npx -y @velella/ebb-mcp
```

Verify that the server is active:

```bash
claude mcp list
```

### Cursor

Add Ebb to your workspace configuration at `.cursor/mcp.json` or your global configuration at `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "ebb": {
      "command": "npx",
      "args": ["-y", "@velella/ebb-mcp"]
    }
  }
}
```

Once saved, reload Cursor or reopen the MCP panel to see `check`, `check_all`, `replacement_for`, and `ebb://upcoming`.

### Codex & Gemini CLI

For Gemini CLI or Antigravity agents:

```bash
gemini mcp add ebb -- npx -y @velella/ebb-mcp
```

Or declare the server in your MCP settings file:

```json
{
  "mcpServers": {
    "ebb": {
      "command": "npx",
      "args": ["-y", "@velella/ebb-mcp"]
    }
  }
}
```

## Available tools

### `check`

Checks whether a package version is end-of-life, deprecated, or healthy.

| Argument | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `purl` | `string` | Yes | Package URL (e.g., `pkg:npm/request@2.88.2` or `pkg:npm/express`) |
| `version` | `string` | No | Version string if omitted from the `purl` argument |
| `asOf` | `string` | No | Evaluation reference date formatted as `YYYY-MM-DD` |

### `check_all`

Evaluates batches of dependencies simultaneously, ideal for whole-repository lockfile or SBOM audits.

| Argument | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `items` | `Array<string \| { purl: string, version?: string }>` | Yes | Array of package identifiers |
| `asOf` | `string` | No | Evaluation reference date formatted as `YYYY-MM-DD` |

### `replacement_for`

Finds canonical replacement packages and migration notes when a component has reached end-of-life or been superseded.

| Argument | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `purl` | `string` | Yes | Package URL of the deprecated component |
| `version` | `string` | No | Current version |

## Available resources

### `ebb://upcoming`

Exposes all upcoming lifecycle milestones (end-of-life, end-of-support, deprecations) that have not yet expired relative to the current date. Returns events sorted with the nearest deadline first.
