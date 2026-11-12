---
title: "Command-Line Interface (CLI)"
description: "Verify dependencies, run batch SBOM checks, inspect lifecycle rules, and discover replacements directly from your terminal."
layout: doc
permalink: /cli/
---

Ebb includes an official zero-dependency command-line interface (`ebb`) that lets you inspect component lifecycle statuses, evaluate dependencies against deprecation and end-of-life rules, and find suggested replacements offline.

## Quick start

Run without installation via `npx`:

```bash
npx @velella/ebb check pkg:npm/request@2.88.2
```

Or install globally:

```bash
npm install -g @velella/ebb
ebb check pkg:npm/request@2.88.2
```

## Terminal Output Format

Ebb produces structured, human-readable terminal output with ANSI colors, source links, replacement guidance, and remaining days for scheduled end-of-life events:

```text
✖ pkg:npm/request@2.88.2: deprecated
  Rule: npm.package.request.deprecated
  Event: deprecated (2020-02-11)
  Replacement: Native fetch or a maintained HTTP client
  Sources:
    - https://www.npmjs.com/package/request
  Offing can fix this: https://github.com/velella-sh/offing
```

For scheduled upcoming events:

```text
⚠ pkg:docker/library/node@22.0.0: scheduled
  Rule: container.node.eol-22-and-older
  Event: scheduled (2027-04-30) [484 days left]
  Replacement: A node image on a later supported release line, such as node:24
  Sources:
    - https://nodejs.org/en/about/eol
  Offing can fix this: https://github.com/velella-sh/offing
```

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

```bash
ebb replacement pkg:npm/request@2.88.2
# Native fetch or a maintained HTTP client
```

### `ebb rules <purl>`

Lists all registered lifecycle rules matching a package or product.

```bash
# All rules for a package
ebb rules pkg:npm/request

# Filter by event
ebb rules pkg:npm/request --event deprecated --json
```

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

## Exit codes

The CLI conforms to standard Unix conventions for script and CI integration:

| Exit code | Meaning | Description |
|-----------|---------|-------------|
| `0` | Success | Verdict is `ok`, all batch components passed within `--fail-on` threshold, or query succeeded. |
| `1` | Finding | Lifecycle finding detected that meets or exceeds `--fail-on` threshold. |
| `2` | Error | CLI error (invalid argument, malformed PURL, or missing input). |
