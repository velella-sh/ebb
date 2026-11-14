---
title: "Model Context Protocol (MCP) server"
description: "Equip AI coding agents (Claude Code, Cursor, Codex, Gemini CLI) with lifecycle checks, deprecation alerts, and migration guidance via Ebb's official MCP server."
layout: doc
permalink: /mcp/
---

# Model Context Protocol (MCP) server

Ebb provides an official [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server under `@velella/ebb-mcp` that exposes lifecycle rules, deprecation advisories, migration recommendations, and upcoming deadlines directly to AI coding agents.

Before an agent chooses a runtime or suggests a library, it queries Ebb over standard stdio JSON-RPC 2.0 without making outbound network requests or installing unnecessary runtime dependencies.

## Agent setup

:::code-tabs{labels='["Claude Code", "Gemini CLI", "Cursor (JSON)", "Claude Desktop (JSON)"]'}
```bash
claude mcp add ebb -- npx -y @velella/ebb-mcp
```
```bash
gemini mcp add ebb -- npx -y @velella/ebb-mcp
```
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
:::

---

## Tools

The server provides three tools over JSON-RPC 2.0:

### `check`
Evaluates a single component against active lifecycle rules.
- **Parameters**:
  - `purl` *(string, required)*: Package URL (e.g. `pkg:npm/left-pad@1.3.0` or `pkg:generic/nodejs@18.20.4`).
  - `version` *(string, optional)*: Component version (if omitted, extracted from the PURL).
- **Returns**: Formatted text containing the verdict, rule identifier, effective date, authoritative sources, reviewer identity, and suggested replacement.

### `check_all`
Evaluates a batch of components in a single round-trip.
- **Parameters**:
  - `components` *(array of objects, required)*: List of `{ purl, version? }` objects.
- **Returns**: Markdown report with a summary table, counts by status, and individual findings.

### `replacement_for`
Returns the suggested modern alternative for a deprecated component.
- **Parameters**:
  - `purl` *(string, required)*: Package URL of the retired component.
  - `version` *(string, optional)*: Specific version.
- **Returns**: Actionable alternative or `null`.

---

## Resources

The server exposes one dynamic resource:

### `ebb://upcoming`
- **MIME type**: `application/json`
- **Description**: Returns all lifecycle events scheduled within the next 90 days across all ecosystems, sorted by deadline.
