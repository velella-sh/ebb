---
title: "Command-Line Interface (CLI)"
description: "Verify dependencies, run batch SBOM checks, inspect lifecycle rules, and discover replacements directly from your terminal."
layout: doc
permalink: /cli/
---

# Command-Line Interface (CLI)

Ebb includes an official zero-dependency command-line interface (`ebb`) that lets you inspect component lifecycle statuses, evaluate dependencies against deprecation and end-of-life rules, and find suggested replacements offline.

## Quick start

:::code-tabs{labels='["npx", "bunx", "global"]'}
```bash
npx @velella/ebb check pkg:npm/request@2.88.2
```
```bash
bunx @velella/ebb check pkg:npm/request@2.88.2
```
```bash
npm install -g @velella/ebb
ebb check pkg:npm/request@2.88.2
```
:::

## Terminal Output Format

Ebb produces structured, human-readable terminal output with ANSI colors, source links, replacement guidance, and remaining days for scheduled end-of-life events:

:::terminal
$ ebb check pkg\:npm/request@2.88.2
✖ pkg\:npm/request@2.88.2: deprecated
  Rule: npm.package.request.deprecated
  Event: deprecated (2020-02-11)
  Replacement: Native fetch or a maintained HTTP client
  Sources:
    - https://www.npmjs.com/package/request
:::

For scheduled upcoming events:

:::terminal
$ ebb check pkg\:docker/library/node@22.0.0
⚠ pkg\:docker/library/node@22.0.0: scheduled
  Rule: container.node.eol-22-and-older
  Event: scheduled (2027-04-30) [484 days left]
  Replacement: A node image on a later supported release line, such as node:24
  Sources:
    - https://nodejs.org/en/about/eol
:::

---

## Commands

### `ebb check <purl> [version]`

Evaluates a component against active lifecycle rules. The version can be embedded in the Package URL (e.g. `pkg:npm/request@2.88.2`) or passed as a separate positional argument.

```bash
# PURL with embedded version
ebb check pkg:npm/request@2.88.2

# Product name with version argument
ebb check node 16.0.0

# Markdown output for PR comments
ebb check pkg:npm/request@2.88.2 --format markdown

# With specific evaluation date
ebb check pkg:docker/library/node@22.0.0 --as-of 2026-04-01

# JSON output
ebb check pkg:npm/request@2.88.2 --json
```

### `ebb as-of <date> <purl> [version]`

Evaluates a component against active lifecycle rules as of a specific date in the past or future with deterministic replay. See [Time-travel evaluation](as-of.md).

Options:
- `--format <text|markdown|json>`: Choose output format (default: `text`).
- `--json`: Shortcut for `--format json`.
- `--fail-on <threshold>`: Minimum severity threshold to fail with exit code `1` (default: `deprecated`).
- `--max-age <days>`: Freshness warning threshold in days (default: `30`).

Examples:
```bash
# Evaluate package status as of April 1, 2026
ebb as-of 2026-04-01 pkg:npm/request@2.88.2

# Check future status of Node.js 22 with JSON output
ebb as-of 2027-05-01 node 22.11.0 --json
```

### `ebb check-all [file]`

Evaluates multiple dependencies in batch mode. Supports JSON lists, CycloneDX SBOM files, or newline-delimited PURLs from files or standard input (`stdin`).

Options:
- `--format <text|markdown|json>`: Output format (default: `text`).
- `--json`: Shortcut for `--format json`.
- `--as-of <YYYY-MM-DD>`: Reference date for time-travel lifecycle evaluation (UTC).
- `--fail-on <threshold>`: Severity threshold (default: `deprecated`).

Examples:
```bash
# From a CycloneDX SBOM or JSON list
ebb check-all bom.json

# Time-travel batch evaluation
ebb check-all bom.json --as-of 2026-04-01

# Markdown summary for CI PR comment
ebb check-all bom.json --format markdown

# From standard input
cat dependencies.txt | ebb check-all

# Output machine-readable JSON
ebb check-all bom.json --json
```

### `ebb replacement <purl> [version]`

Finds suggested replacements or migration recommendations for deprecated packages.

:::terminal
$ ebb replacement pkg\:npm/request@2.88.2
Native fetch or a maintained HTTP client
:::

### `ebb versions <purl>`

Lists the release lines Ebb can name for a runtime or package, and marks the one it recommends. The recommendation is the line whose known end date is furthest ahead, when that date is more than 180 days after `--as-of`. The output says what Ebb knows. It does not say the line is supported. See [Which version should I install](pick-version.md).

```bash
ebb versions node --as-of 2026-11-15
ebb versions python --as-of 2026-11-15 --format markdown
ebb versions pkg:npm/request --as-of 2026-11-15 --json
```

### `ebb rules <purl>`

Lists all registered lifecycle rules matching a package or product.

```bash
# All rules for a package
ebb rules pkg:npm/request

# Filter by event
ebb rules pkg:npm/request --event deprecated --json
```

### `ebb upcoming [options]`

Lists scheduled and upcoming end-of-life and deprecation deadlines within a specified time window. See [Upcoming deadlines](upcoming.md).

Options:
- `--within <span|days>`: Time window: `30d`, `2w`, `3m`, `1y`, or number of days (default: `90d`).
- `--fail-within <span|days>`: Exit with code `1` when any matching event deadline falls inside this window.
- `--countdown`: Show days left and a progress bar for each event, falling back to plain text off-terminal.
- `--format <text|markdown|json|ical>`: Choose output format (default: `text`). Use `ical` to generate an RFC 5545 calendar.
- `--ecosystem <name>`: Filter by ecosystem (e.g. `npm`, `python`).
- `--purl <purl>`: Filter by package URL.
- `--as-of <YYYY-MM-DD>`: Reference date for calculation (UTC).

Exit codes for `ebb upcoming`:

| Exit code | Meaning | Description |
|-----------|---------|-------------|
| `0` | Success | No matching events fall inside `--fail-within` (or `--fail-within` omitted). |
| `1` | Deadline approaching | At least one matching deadline falls inside the `--fail-within` window. |
| `2` | Error | CLI error (invalid window, malformed date, or invalid argument). |

Examples:
```bash
# Query deadlines within 90 days for npm packages
ebb upcoming --within 90d --ecosystem npm

# Export upcoming deadlines to an iCalendar file
ebb upcoming --format ical > upcoming.ics

# Fail in CI if any deadline falls within 30 days
ebb upcoming --fail-within 30d
```

### `ebb forecast [options]`

Forecasts lifecycle deadlines grouped by month across a forward-looking window using registered rules.

Options:
- `--months <count>`: Forecast window in months (default: `12`).
- `--ecosystem <name>`: Filter by ecosystem (e.g. `nodejs`, `python`).
- `--as-of <YYYY-MM-DD>`: Reference date for forecast calculation (UTC).
- `--format <text|markdown|json>`: Output format (default: `text`).
- `--json`: Shortcut for `--format json`.

Examples:
```bash
# 6-month forecast across all ecosystems
ebb forecast --months 6

# Forecast Node.js runtime deadlines in JSON format
ebb forecast --ecosystem nodejs --as-of 2026-04-01 --json
```

### `ebb recent [options]`

Lists software lifecycle events whose deadlines have passed within a recent time window.

Options:
- `--within <span|days>`: Past time window: `30d`, `2w`, `3m`, `1y`, or number of days (default: `90d`).
- `--ecosystem <name>`: Filter by ecosystem.
- `--purl <purl>`: Filter by package URL.
- `--as-of <YYYY-MM-DD>`: Reference date for calculation (UTC).
- `--format <text|markdown|json>`: Output format (default: `text`).
- `--json`: Shortcut for `--format json`.

Examples:
```bash
# What reached end-of-life in the last 30 days
ebb recent --within 30d

# Recent events for npm packages as JSON
ebb recent --ecosystem npm --within 6m --json
```

### `ebb stale`

Lists lifecycle rules whose review window has expired, and rules that will expire soon. See [Stale rule review](stale.md).

```bash
# Per-registry freshness windows
ebb stale

# Fixed reference day
ebb stale --as-of 2026-11-14

# Override the review age
ebb stale --older-than 90d --json
```

### `ebb sources <rule-id>`

Inspects authoritative evidence sources, archive snapshot URLs, health status, and review provenance for a lifecycle rule. See [Evidence Sources](sources-of.md).

```bash
# Human-readable output
ebb sources npm.package.request.deprecated

# Markdown formatted summary
ebb sources npm.package.request.deprecated --format markdown

# JSON output
ebb sources npm.package.request.deprecated --json
```

### `ebb verify <file>`

Verifies a lifecycle data bundle or release artifact against its Sigstore keyless signature offline. Enforces signer identity, content digest, file integrity, and rollback protection. See [Lifecycle Data](DATA.md).

```bash
# Verify a bundle against its default companion signature (<file>.sigstore.json)
ebb verify dist/data/bundle.json

# Explicit signature path
ebb verify bundle.json --signature bundle.json.sigstore.json

# Machine-readable JSON
ebb verify dist/data/bundle.json --json
```

### `ebb update`

Updates lifecycle data safely, atomically, and reversibly without upgrading the npm package. Downloads the newest signed data release, verifies the Sigstore signature offline, and updates the local user cache. Supports rollback to previous versions.

```bash
# Update to the latest verified data release
ebb update

# Update from a local bundle file and adjacent signature (offline / air-gapped)
ebb update --from path/to/ebb-data-2026.10.16.json

# Explicit offline mode preventing any network requests
ebb update --offline

# Check for updates without downloading
ebb update --check

# Roll back to the previous cached data version or bundled data
ebb update --rollback

# Pin a specific data version
ebb update 2026.10.15

# Check and update only if cached data is older than window
ebb update --if-older-than 7d

# Use the pre-release channel
ebb update --channel next

# Output machine-readable JSON
ebb update --json
```

### `ebb diff [from] [to]`

Compares two data releases, bundle files, dates, or active data and reports added, changed, removed, and renamed rules with field-level change tracking (deadline shifts, event upgrades, source updates).

```bash
# Compare bundled data to active cached data
ebb diff

# Compare two versions
ebb diff 2026.10.01 2026.10.16

# Compare active data since a specific release version
ebb diff --since 2026.10.16

# Compare active data since a release version, downloading bundle if needed
ebb diff --since 2026.10.01 --fetch

# Compare bundle files
ebb diff dist/bundle-v1.json dist/bundle-v2.json

# Generate Markdown release notes
ebb diff 2026.10.01 2026.10.16 --format markdown

# Filter by ecosystem
ebb diff --ecosystem npm --json
```

### `ebb cache <path|info|clear>`

Inspects, queries, or clears Ebb's downloaded lifecycle data cache.

- **`ebb cache path`**: Prints the filesystem path to the cache directory without creating it.
- **`ebb cache info`**: Shows the active data version, cached file sizes, and fetch date in text or JSON format. Reports when the cache is empty.
- **`ebb cache clear`**: Removes downloaded data bundles and the rollback copy, reporting what was deleted. Refuses to run if `EBB_DATA_DIR` points outside a directory that looks like an Ebb cache directory.

```bash
# Print cache directory location without creating it
ebb cache path

# Inspect cached files, sizes, and active version
ebb cache info
ebb cache info --json

# Clear downloaded cache and rollback copies
ebb cache clear
```

### `ebb data-status`

Display active lifecycle data freshness, source origin (`package` or `cache`), cache path, rollback copy availability, review date, and evidence age in calendar days. Flags stale data exceeding the 30-day (or configured) threshold.

```bash
# Print human-readable status
ebb data-status

# Output as JSON (includes origin, cachePath, and hasRollback fields)
ebb data-status --json

# Set a custom threshold
ebb data-status --max-age 14
```

### `ebb release-log [options]`

List signed lifecycle data releases known to the local release log (`release-log.jsonl`), including version, release date, content digest, and hash-chain verification. Reads local files only without network requests.

Options:
- `--format <text|markdown|json>`: Output format (default: text).
- `--json`: Shortcut for `--format json`.

Examples:
```bash
# List known data releases
ebb release-log

# Output machine-readable JSON
ebb release-log --json
```

### `ebb mcp`

Starts the Model Context Protocol (MCP) server over standard input/output (stdio), providing tools and resources for AI coding agents. See [MCP Server](mcp.md).

Options:
- `--print-config <agent>`: Print MCP configuration snippet for an agent (`claude-code`, `cursor`, `codex`, `gemini`, `vscode`, `windsurf`, `zed`).
- `--self-test`: Verify MCP data loading and tool execution offline.

Examples:
```bash
# Print configuration for Claude Code
ebb mcp --print-config claude-code

# Run MCP self-test
ebb mcp --self-test
```

---

## Formatting & Output Options

- `--format <text|markdown|json|ical>`: Choose output format. Defaults to `text`.
- `--json`: Shortcut for `--format json`.
- `--fail-on <threshold>`: Minimum severity that exits with code `1`. Supported values:
  - `scheduled`: Fails on scheduled, deprecated, unsupported, end-of-life, removed, or error.
  - `deprecated` (default): Fails on deprecated, unsupported, end-of-life, removed, or error (`scheduled` issues return exit code 0).
  - `unsupported`: Fails on unsupported, end-of-life, removed, or error.
  - `end-of-life`: Fails on end-of-life, removed, or error.
  - `error`: Fails only on parse/lookup errors.
  - `none`: Always exits with code 0 on findings.
- `--no-color` / `NO_COLOR`: Disables ANSI colors, conforming to the [NO_COLOR specification](https://no-color.org/).
- `--color`: Forces colored output.
- `--no-hint`: Deprecated (no-op).
- `--offline`: Run in offline mode; blocks any network requests.
- `--from <file>`: Update data from a local bundle file and adjacent signature (used with `ebb update`).
- `-q`, `--quiet`: Silence warnings on stderr.
- `--min-confidence <level>`: Minimum confidence level required to report a finding (`tentative`, `likely`, or `confirmed`). Weaker findings are hidden. Defaults to `tentative` (all findings shown).

> [!TIP]
> In CI workflows, use `--format markdown` to generate clean PR comment summaries, or `--json` to pipe into downstream automation.

---

## Exit codes

The CLI conforms to standard Unix conventions for script and CI integration:

| Exit code | Meaning | Description |
|-----------|---------|-------------|
| `0` | Success | Verdict is `ok`, all batch components passed within `--fail-on` threshold, or query succeeded. |
| `1` | Finding | Lifecycle finding detected that meets or exceeds `--fail-on` threshold. |
| `2` | Error | CLI error (invalid argument, malformed PURL, or missing input). |
