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

Snippets below are generated from `ebb mcp --print-config <agent>` (copyable body only). The config path or command scope for each client is listed in the table, not inside the tab body.

| Agent | Config path / command scope |
|---|---|
| Claude Code | claude CLI (`claude mcp add`) |
| Cursor | ~/.cursor/mcp.json (or project .cursor/mcp.json) |
| Codex | ~/.codex/config.toml |
| Gemini CLI | gemini CLI (`gemini mcp add`) |
| VS Code | .vscode/mcp.json |
| Windsurf | ~/.codeium/windsurf/mcp_config.json |
| Zed | Zed settings.json (`context_servers`; open via `zed: open settings file`) |

:::code-tabs{labels='["Claude Code","Cursor","Codex","Gemini CLI","VS Code","Windsurf","Zed"]'}
<!-- mcp-print-config:claude-code -->
```bash
claude mcp add ebb -- npx -y @velella/ebb mcp
```
<!-- /mcp-print-config:claude-code -->
<!-- mcp-print-config:cursor -->
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
<!-- /mcp-print-config:cursor -->
<!-- mcp-print-config:codex -->
```toml
[mcp_servers.ebb]
command = "npx"
args = ["-y","@velella/ebb","mcp"]
```
<!-- /mcp-print-config:codex -->
<!-- mcp-print-config:gemini -->
```bash
gemini mcp add ebb -- npx -y @velella/ebb mcp
```
<!-- /mcp-print-config:gemini -->
<!-- mcp-print-config:vscode -->
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
<!-- /mcp-print-config:vscode -->
<!-- mcp-print-config:windsurf -->
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
<!-- /mcp-print-config:windsurf -->
<!-- mcp-print-config:zed -->
```json
{
  "context_servers": {
    "ebb": {
      "command": "npx",
      "args": [
        "-y",
        "@velella/ebb",
        "mcp"
      ],
      "env": {}
    }
  }
}
```
<!-- /mcp-print-config:zed -->
:::

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

A successful run prints a single line such as `ebb mcp self-test ok (@velella/ebb <version>, data …)` and exits `0`.

---

## Troubleshooting

Start here. Before changing agent config, confirm the package itself works:

```bash
npx -y @velella/ebb mcp --self-test
```

A successful run prints one line and exits `0`. On failure, fix the install or data before debugging the agent.

### Server not listed in the agent

**Cause:** The agent config is missing, points at the old package name, or omits the `mcp` argument.

**Fix:** Print a fresh snippet with `npx -y @velella/ebb mcp --print-config <agent>`, paste it at the `Path:` the CLI names, and restart the agent. Then re-run `--self-test`.

### Old Node.js

**Cause:** Ebb requires Node.js `>=22` (`package.json` `engines`). The bin entry refuses older runtimes with empty stdout and this stderr message:

```text
ebb requires Node.js >=22. This process is running v18.20.0. Please upgrade Node.js and try again.
```

**Fix:** Upgrade Node, then re-run `--self-test`.

### Stale npx cache

**Cause:** A sticky npx cache can keep an old tarball even with `-y`.

**Fix:** Prefer a temporary cache (does not wipe your whole npm cache):

```bash
NPM_CONFIG_CACHE=$(mktemp -d) npx -y @velella/ebb mcp --self-test
```

Or remove only the cached `@velella/ebb` entry under your npm cache (`$(npm config get cache)/_npx`) and retry `npx -y @velella/ebb mcp --self-test`.

### Proxy / network installs

**Cause:** `npx` needs registry access once to download `@velella/ebb`.

**Fix:** Configure npm proxy settings (`HTTP_PROXY` / `HTTPS_PROXY` / `npm config set proxy`) if you are behind a corporate proxy. After the package is cached locally, the MCP server itself stays offline: it does not call the network while answering lifecycle tools.

### Self-test failures

**Cause:** Bundled/pinned data could not load, or the known check did not return `deprecated`.

**Fix:** `--self-test` drives the MCP `check` tool handler against `pkg:npm/request@2.88.2`. On failure it prints one of:

- `self-test check failed: expected status "deprecated", got "…"`
- `self-test failed: …`

Fix the install or data bundle before debugging agent wiring.

---

## Release smoke (after publish)

Do **not** run this against an unpublished version. After `@velella/ebb` is on npm:

1. Empty-cache self-test (unpinned latest):
   ```bash
   NPM_CONFIG_CACHE=$(mktemp -d) npx -y @velella/ebb mcp --self-test
   ```
2. Empty-cache stdio handshake (unpinned):
   ```bash
   CACHE=$(mktemp -d)
   NPM_CONFIG_CACHE="$CACHE" npx -y @velella/ebb mcp
   ```
   Send a JSON-RPC `initialize` on stdin. Assert `result.serverInfo.name` equals the installed package name and `result.serverInfo.version` equals the installed `package.json` `version` (read from the npx install under that cache). Then close stdin.

Pre-merge coverage of the same install path uses the packed tarball stdio test (`tests/mcp/packed.test.ts`) against the version in this repo's `package.json` in an empty temp directory.
