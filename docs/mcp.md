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

## Ask before you install

Before running an install command, updating `package.json` / `requirements.txt`, or choosing a runtime version, coding agents should consult Ebb over MCP:

1. **Before running a package install command:** Call `check_install` with the exact command (e.g. `npm install request@2.88.2` or `pip install flask`). Ebb parses the packages, extracts version constraints, and checks all of them against authoritative lifecycle rules without executing shell commands or reading disk.
2. **Before installing or upgrading a specific package:** Call `check` with a PURL or product name and version. If the package is deprecated or past end-of-life, Ebb returns the deadline, authoritative evidence URLs, review dates, confidence tiers, and recommended replacement.
3. **Before picking a runtime or major version:** Call `pick_version` (e.g. `{ "purl": "node" }`) to inspect active release lines and receive the recommended supported version.
4. **Before planning maintenance or sprint cycles:** Call `upcoming` to see upcoming scheduled end-of-life events within a lookahead window (e.g. 90 days).

## Tools

The server provides these tools over JSON-RPC 2.0:

| Tool | Description |
|---|---|
| `check` | Call before installing or upgrading a package or runtime version. Checks against known end-of-life and deprecation dates. |
| `check_all` | Call before installing or auditing multiple packages or dependencies in batch. Checks each against known end-of-life and deprecation dates. |
| `check_install` | Call before running an install command. Parses package manager commands (npm, pnpm, yarn, bun, pip, cargo, go) and checks every package against lifecycle rules. |
| `diff` | Call to compare two lifecycle data versions, dates, files, or active data and inspect added, changed, or removed rules. |
| `pick_version` | Call before choosing a runtime or a major version. Returns known release lines, the recommended line, and whether coverage is complete. |
| `replacement_for` | Call when a component is deprecated or end-of-life to find recommended migration targets or alternatives. |
| `sources_of` | Call to inspect authoritative sources, archive snapshot URLs, health status, and review provenance for a lifecycle rule. |
| `upcoming` | Call before planning upgrades to list scheduled deprecation and end-of-life deadlines within a time window. |

### `check`
Call before installing or upgrading a package or runtime version. Checks against known end-of-life and deprecation dates.

- **Parameters**:
  - `purl` *(string, required)*: Package URL (e.g. `pkg:npm/request@2.88.2`, `pkg:npm/request`) or bare product name (e.g. `node`).
  - `version` *(string, optional)*: Component version (if omitted, extracted from the PURL).
  - `as_of` *(string, optional)*: Reference date `YYYY-MM-DD` for time-travel evaluation.
- **Example call**:
  ```json
  {
    "name": "check",
    "arguments": {
      "purl": "pkg:npm/request@2.88.2"
    }
  }
  ```
- **Example answer**:
  ```json
  {
    "schemaVersion": 1,
    "status": "deprecated",
    "version": "2.88.2",
    "dataVersion": "0.3.0",
    "matches": [
      {
        "ruleId": "npm.package.request.deprecated",
        "canonicalUrl": "https://velella.sh/ebb/rules/npm-package-request-deprecated/",
        "event": "deprecated",
        "date": "2020-02-11",
        "daysLeft": null,
        "replacement": "undici",
        "sources": [
          { "url": "https://github.com/request/request/issues/3142" }
        ],
        "reviewedAt": "2026-11-14",
        "confidence": "confirmed"
      }
    ],
    "provenance": {
      "sources": ["https://github.com/request/request/issues/3142"],
      "reviewers": ["arminazimi"]
    }
  }
  ```

### `check_all`
Call before installing or auditing multiple packages or dependencies in batch. Checks each against known end-of-life and deprecation dates.

- **Parameters**:
  - `items` *(array, optional)*: Array of PURL strings or `{ purl, version? }` objects.
  - `purls` *(array, optional)*: Alias for `items`.
  - `as_of` *(string, optional)*: Reference date `YYYY-MM-DD`.
- **Example call**:
  ```json
  {
    "name": "check_all",
    "arguments": {
      "items": ["pkg:npm/request@2.88.2", { "purl": "pkg:npm/left-pad", "version": "1.3.0" }]
    }
  }
  ```
- **Example answer**:
  ```json
  {
    "summary": { "total": 2, "byStatus": { "deprecated": 2 } },
    "dataVersion": "0.3.0",
    "results": [
      { "status": "deprecated", "version": "2.88.2", "matches": [...] },
      { "status": "deprecated", "version": "1.3.0", "matches": [...] }
    ],
    "provenance": { "sources": [...], "reviewers": [...] }
  }
  ```

### `check_install`
Call before running an install command. Parses package manager commands (npm, pnpm, yarn, bun, pip, cargo, go) and checks every package against lifecycle rules.

- **Parameters**:
  - `command` *(string, required)*: Raw shell install command string.
  - `as_of` *(string, optional)*: Reference date `YYYY-MM-DD`.
- **Example call**:
  ```json
  {
    "name": "check_install",
    "arguments": {
      "command": "npm install request@2.88.2 express@4.18.2"
    }
  }
  ```
- **Example answer**:
  ```json
  {
    "command": "npm install request@2.88.2 express@4.18.2",
    "packages": [
      { "purl": "pkg:npm/request", "version": "2.88.2" },
      { "purl": "pkg:npm/express", "version": "4.18.2" }
    ],
    "summary": { "total": 2, "byStatus": { "deprecated": 1, "ok": 1 } },
    "results": [...]
  }
  ```

### `diff`
Call to compare two lifecycle data versions, dates, files, or active data and inspect added, changed, or removed rules.

- **Parameters**:
  - `since` *(string, optional)*: Data release version to compare against active data (e.g. `2026.10.16`).
  - `from` *(string, optional)*: Starting version, date, file path, `bundled`, or `active` (default `bundled`).
  - `to` *(string, optional)*: Target version, date, file path, or `active` (default `active`).
  - `ecosystem` *(string, optional)*: Ecosystem filter.
  - `format` *(string, optional)*: `markdown` (default) or `json`.
- **Example call**:
  ```json
  {
    "name": "diff",
    "arguments": {
      "since": "2026.10.16",
      "format": "json"
    }
  }
  ```
- **Example answer**:
  ```json
  {
    "from": "cached version 2026.10.16",
    "to": "active",
    "summary": { "added": 12, "changed": 3, "removed": 0, "renamed": 1 },
    "counts": { "added": 12, "changed": 3, "removed": 0, "renamed": 1, "total": 782 },
    "changedRuleIds": {
      "added": ["npm.package.left-pad.deprecated"],
      "changed": ["npm.package.request.deprecated"],
      "removed": [],
      "renamed": [{"from": "npm.old.rule", "to": "npm.new.rule"}]
    },
    "added": [...],
    "changed": [...],
    "removed": [],
    "renamed": [...]
  }
  ```

### `pick_version`
Call before choosing a runtime or a major version. Returns known release lines, the recommended line, and whether coverage is complete.

- **Parameters**:
  - `purl` *(string, required)*: Package URL or product name (e.g. `node`, `python`, `pkg:generic/nodejs`).
  - `as_of` *(string, optional)*: Reference date `YYYY-MM-DD`. When set, the system clock is not read.
- **Example call**:
  ```json
  {
    "name": "pick_version",
    "arguments": {
      "purl": "node",
      "as_of": "2026-11-15"
    }
  }
  ```
- **Example answer**:
  ```json
  {
    "purl": "pkg:generic/nodejs",
    "asOf": "2026-11-15",
    "lines": [{ "id": "22.x" }, { "id": "24.x" }, { "id": "26.x" }],
    "recommendation": { "lineId": "26.x" },
    "complete": true,
    "reason": "recommended active line"
  }
  ```

### `replacement_for`
Call when a component is deprecated or end-of-life to find recommended migration targets or alternatives.

- **Parameters**:
  - `purl` *(string, required)*: Package URL of the retired component.
  - `version` *(string, optional)*: Specific version.
- **Example call**:
  ```json
  {
    "name": "replacement_for",
    "arguments": {
      "purl": "pkg:npm/request",
      "version": "2.88.2"
    }
  }
  ```
- **Example answer**:
  ```json
  {
    "purl": "pkg:npm/request",
    "version": "2.88.2",
    "replacement": "undici"
  }
  ```

### `sources_of`
Call to inspect authoritative sources, archive snapshot URLs, health status, and review provenance for a lifecycle rule.

- **Parameters**:
  - `ruleId` *(string, required)*: Rule identifier (e.g. `npm.package.request.deprecated`).
  - `as_of` *(string, optional)*: Reference date `YYYY-MM-DD`.
- **Example call**:
  ```json
  {
    "name": "sources_of",
    "arguments": {
      "ruleId": "npm.package.request.deprecated"
    }
  }
  ```
- **Example answer**:
  ```json
  {
    "ruleId": "npm.package.request.deprecated",
    "purl": "pkg:npm/request",
    "ecosystem": "npm",
    "name": "request",
    "status": "deprecated",
    "sources": [
      {
        "url": "https://github.com/request/request/issues/3142",
        "archiveUrl": "https://web.archive.org/web/...",
        "health": "ok"
      }
    ],
    "reviewer": "arminazimi",
    "reviewedAt": "2026-11-14"
  }
  ```

### `upcoming`
Call before planning upgrades to list scheduled deprecation and end-of-life deadlines within a time window.

- **Parameters**:
  - `within` *(string, optional)*: Lookahead window (e.g. `30d`, `6m`, `1y`, default `10y`).
  - `ecosystem` *(string, optional)*: Ecosystem filter (e.g. `npm`, `ci-images`, `python`).
  - `purl` *(string, optional)*: Package URL or product name filter.
  - `as_of` *(string, optional)*: Reference date `YYYY-MM-DD`.
- **Example call**:
  ```json
  {
    "name": "upcoming",
    "arguments": {
      "within": "90d",
      "ecosystem": "npm"
    }
  }
  ```
- **Example answer**:
  ```json
  {
    "asOf": "2026-11-16",
    "count": 3,
    "events": [
      {
        "ruleId": "npm.package.example.scheduled",
        "purl": "pkg:npm/example",
        "event": "scheduled",
        "deadline": "2026-12-31",
        "daysLeft": 45,
        "replacement": null,
        "sources": [{ "url": "https://example.com/eol" }],
        "reviewedAt": "2026-11-10"
      }
    ]
  }
  ```

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

---

## Benchmark Evaluations

To inspect empirical benchmark results measuring agent accuracy with and without the Ebb MCP server, see [Agent Evaluations](agent-evals.md).
