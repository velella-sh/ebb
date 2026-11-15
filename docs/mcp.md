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

---

## Troubleshooting

### Server not listed in the agent

Confirm the agent config runs `npx -y @velella/ebb mcp` (including the trailing `mcp` argument). Print a fresh snippet with `npx -y @velella/ebb mcp --print-config <agent>` and replace the old entry. Restart the agent after saving config. Then run:

```bash
npx -y @velella/ebb mcp --self-test
```

If self-test fails, the package or data load is broken before the agent ever talks to stdio.

### Old Node.js

Ebb requires Node.js `>=22` (`package.json` `engines`). The bin entry refuses older runtimes with empty stdout and a stderr message like:

```text
ebb requires Node.js >=22. This process is running v18.20.0. Please upgrade Node.js and try again.
```

Upgrade Node, then re-run `--self-test`.

### Stale npx cache

`npx -y` should fetch the latest publish, but a sticky cache can keep an old tarball. Clear the npx cache for the package and retry:

```bash
npm cache clean --force
npx -y @velella/ebb mcp --self-test
```

### Proxy / network installs

`npx` needs registry access once to download `@velella/ebb`. Configure npm proxy settings (`HTTP_PROXY` / `HTTPS_PROXY` / `npm config set proxy`) if you are behind a corporate proxy. After the package is cached locally, the MCP server itself stays offline: it does not call the network while answering lifecycle tools.

### Self-test failures

`--self-test` loads bundled data and checks `pkg:npm/request@2.88.2`. On failure it prints one of:

- `self-test check failed: expected status "deprecated", got "…"`
- `self-test failed: …`

Fix the install or data bundle before debugging agent wiring.
