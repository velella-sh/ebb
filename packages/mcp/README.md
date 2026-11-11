# @velella/ebb-mcp

Official Model Context Protocol (MCP) server for [Ebb](https://github.com/velella-sh/ebb).

Give your AI coding agents direct access to software lifecycle data, deprecation alerts, end-of-life timelines, and verified migration replacements before they recommend dependencies or pick runtimes.

Zero third-party runtime dependencies: communicates over standard JSON-RPC 2.0 on `stdio` using Node.js built-ins.

## Quickstart

Run directly with `npx`:

```bash
npx -y @velella/ebb-mcp
```

## Installation by Agent

### Claude Code

Add the server to Claude Code using the `claude mcp add` command:

```bash
claude mcp add ebb -- npx -y @velella/ebb-mcp
```

To scope it globally across all projects:

```bash
claude mcp add -s global ebb -- npx -y @velella/ebb-mcp
```

Verify installation:

```bash
claude mcp list
```

### Cursor

Add Ebb to your project's `.cursor/mcp.json` or global `~/.cursor/mcp.json`:

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

### Codex & Gemini CLI

For Gemini CLI or Antigravity, add the server using the CLI:

```bash
gemini mcp add ebb -- npx -y @velella/ebb-mcp
```

Or configure it in your MCP configuration file (`mcpServers` section):

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

## Tools

### `check`

Evaluates a single dependency or runtime against known lifecycle rules.

**Parameters:**
- `purl` *(string, required)*: Package URL (e.g. `pkg:npm/express@4.21.0` or `pkg:npm/express`).
- `version` *(string, optional)*: Explicit version if not embedded in the PURL.
- `asOf` *(string, optional)*: ISO date (`YYYY-MM-DD`) to evaluate against.

### `check_all`

Evaluates a batch of dependencies (e.g. from an SBOM or lockfile).

**Parameters:**
- `items` *(array, required)*: Array of PURL strings or `{ purl, version? }` objects.
- `asOf` *(string, optional)*: ISO date (`YYYY-MM-DD`) to evaluate against.

### `replacement_for`

Looks up recommended migration targets and canonical replacement packages for deprecated or end-of-life software.

**Parameters:**
- `purl` *(string, required)*: Package URL of the component being replaced.
- `version` *(string, optional)*: Current version.

## Resources

### `ebb://upcoming`

Returns active upcoming software lifecycle milestones (end-of-life, end-of-support, deprecations) sorted chronologically with the nearest deadlines first. Expired events are automatically excluded.

## License

Apache-2.0
