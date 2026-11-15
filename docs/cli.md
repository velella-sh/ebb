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
$ ebb check pkg:npm/request@2.88.2
✖ pkg:npm/request@2.88.2: deprecated
  Rule: npm.package.request.deprecated
  Event: deprecated (2020-02-11)
  Replacement: Native fetch or a maintained HTTP client
  Sources:
    - https://www.npmjs.com/package/request
  Offing can fix this: https://github.com/velella-sh/offing
:::

For scheduled upcoming events:

:::terminal
$ ebb check pkg:docker/library/node@22.0.0
⚠ pkg:docker/library/node@22.0.0: scheduled
  Rule: container.node.eol-22-and-older
  Event: scheduled (2027-04-30) [484 days left]
  Replacement: A node image on a later supported release line, such as node:24
  Sources:
    - https://nodejs.org/en/about/eol
  Offing can fix this: https://github.com/velella-sh/offing
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

### `ebb check-all [file]`

Evaluates multiple dependencies in batch mode. Supports JSON lists, CycloneDX SBOM files, or newline-delimited PURLs from files or standard input (`stdin`).

```bash
# From a CycloneDX SBOM or JSON list
ebb check-all bom.json

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
$ ebb replacement pkg:npm/request@2.88.2
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

# Check for updates without downloading
ebb update --check

# Roll back to the previous cached data version or bundled data
ebb update --rollback

# Pin a specific data version
ebb update 2026.10.15

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

# Compare bundle files
ebb diff dist/bundle-v1.json dist/bundle-v2.json

# Generate Markdown release notes
ebb diff 2026.10.01 2026.10.16 --format markdown

# Filter by ecosystem
ebb diff --ecosystem npm --json
```

### `ebb data-status`

Display active lifecycle data freshness, source origin, review date, and evidence age in calendar days. Flags stale data exceeding the 30-day (or configured) threshold.

```bash
# Print human-readable status
ebb data-status

# Output as JSON
ebb data-status --json

# Set a custom threshold
ebb data-status --max-age 14
```

---

## Formatting & Output Options

- `--format <text|markdown|json>`: Choose output format. Defaults to `text`.
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
- `--no-hint` / `EBB_NO_HINT=1`: Disables the Offing remediation hint line.

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
