---
title: "Model Context Protocol (MCP) server"
description: "Equip AI coding agents with lifecycle checks, deprecation alerts, and migration guidance via Ebb's MCP server (`ebb mcp`)."
layout: doc
permalink: /mcp/
---

# Model Context Protocol (MCP) server

Ebb ships an official [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server inside `@velella/ebb`. Start it with:

```bash
npx -y @velella/ebb mcp
```

The server speaks stdio JSON-RPC 2.0, runs offline, and adds no runtime dependencies to the core package.

Print a ready-to-paste snippet for your agent (does not write config files):

```bash
npx -y @velella/ebb mcp --print-config <agent>
```

Supported agents: `claude-code`, `cursor`, `codex`, `gemini`, `vscode`, `windsurf`, `zed`.

## Agent setup

Snippets below are generated from `ebb mcp --print-config <agent>` and all run `npx -y @velella/ebb mcp`.

### Claude Code

```bash
claude mcp add ebb -- npx -y @velella/ebb mcp
```

### Cursor

```json
{
  "mcpServers": {
    "ebb": {
      "command": "npx",
      "args": [
        "-y",
        "@velella/ebb",
        "mcp"
      ]
    }
  }
}
```

### Codex

```toml
[mcp_servers.ebb]
command = "npx"
args = ["-y","@velella/ebb","mcp"]
```

### Gemini CLI

```bash
gemini mcp add ebb -- npx -y @velella/ebb mcp
```

### VS Code

```json
{
  "servers": {
    "ebb": {
      "command": "npx",
      "args": [
        "-y",
        "@velella/ebb",
        "mcp"
      ]
    }
  }
}
```

### Windsurf

```json
{
  "mcpServers": {
    "ebb": {
      "command": "npx",
      "args": [
        "-y",
        "@velella/ebb",
        "mcp"
      ]
    }
  }
}
```

### Zed

```json
{
  "context_servers": {
    "ebb": {
      "command": {
        "path": "npx",
        "args": [
          "-y",
          "@velella/ebb",
          "mcp"
        ]
      }
    }
  }
}
```

---

## Tools

The server provides these tools over JSON-RPC 2.0:

### `check`
Evaluates a single component against active lifecycle rules.
- **Parameters**:
  - `purl` *(string, required)*: Package URL (e.g. `pkg:npm/left-pad@1.3.0` or `pkg:generic/nodejs@18.20.4`).
  - `version` *(string, optional)*: Component version (if omitted, extracted from the PURL).
  - `asOf` *(string, optional)*: Reference date `YYYY-MM-DD`.
- **Returns**: Formatted text containing the verdict, rule identifier, effective date, authoritative sources, reviewer identity, and suggested replacement.

### `check_all`
Evaluates a batch of components in a single round-trip.
- **Parameters**:
  - `purls` *(array, required)*: List of PURL strings or `{ purl, version? }` objects.
- **Returns**: Markdown or JSON report with a summary table, counts by status, and individual findings.

### `replacement_for`
Returns the suggested modern alternative for a deprecated component.
- **Parameters**:
  - `purl` *(string, required)*: Package URL of the retired component.
  - `version` *(string, optional)*: Specific version.
- **Returns**: Actionable alternative or `null`.

### `sources_of`
Looks up evidence sources and provenance for a lifecycle rule.
- **Parameters**:
  - `ruleId` *(string, required)*: Rule id (e.g. `npm.package.request.deprecated`).
  - `asOf` *(string, optional)*: Reference date `YYYY-MM-DD`.

### `diff`
Compares two lifecycle data versions or files.
- **Parameters**:
  - `from` / `to` *(string, optional)*: Version, date, file path, `bundled`, or `active`.
  - `ecosystem` *(string, optional)*: Filter.
  - `format` *(string, optional)*: `markdown` or `json`.

---

## Resources

### `ebb://upcoming`
- **MIME type**: `application/json`
- **Description**: Scheduled software deprecation and end-of-life dates that have not yet occurred.

---

## Self-test

Verify the installed package can load data and answer a known check without starting the stdio loop:

```bash
npx -y @velella/ebb mcp --self-test
```

A successful run prints a single line such as `ebb mcp self-test ok (@velella/ebb 0.2.0, data …)` and exits `0`.
