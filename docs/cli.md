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

## Commands

### `ebb check <purl> [version]`

Evaluates a component against active lifecycle rules. The version can be embedded in the Package URL (e.g. `pkg:npm/request@2.88.2`) or passed as a separate positional argument.

```bash
# PURL with embedded version
ebb check pkg:npm/request@2.88.2

# Product name with version argument
ebb check node 16.0.0

# With specific evaluation date
ebb check pkg:npm/request@2.88.2 --as-of 2026-04-01

# JSON output
ebb check pkg:npm/request@2.88.2 --json
```

### `ebb check-all [file]`

Evaluates multiple dependencies in batch mode. Supports JSON lists, CycloneDX SBOM files, or newline-delimited PURLs from files or standard input (`stdin`).

```bash
# From a CycloneDX SBOM or JSON list
ebb check-all bom.json

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

## Exit codes

The CLI conforms to standard Unix conventions for script and CI integration:

| Exit code | Meaning | Description |
|-----------|---------|-------------|
| `0` | Success | Check verdict is `ok`, all batch components passed, or query succeeded. |
| `1` | Finding | Lifecycle issue detected (deprecated, unsupported, end-of-life, removed, scheduled). |
| `2` | Error | CLI error (invalid argument, malformed PURL, or missing input). |
