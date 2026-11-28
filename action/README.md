# Ebb GitHub Action

The official GitHub Action for **Ebb**, the open almanac of software end-of-life.

Integrate continuous lifecycle checks directly into your GitHub Actions workflows to catch deprecated packages, scheduled end-of-life runtimes, and removed components before they break production.

## Features

- **Zero dependencies**: Fast, lightweight, pure Node.js execution.
- **Job Summary**: Automatically writes formatted Markdown summaries to GitHub Step Summary.
- **Workflow Annotations**: Emits inline GitHub annotations (`::warning::`, `::error::`) on findings.
- **Configurable Thresholds**: Control failure severity with `fail-on` (`scheduled`, `deprecated`, `unsupported`, `end-of-life`, `removed`, `error`, `none`).

## Usage

### 1. Check Specific Packages

```yaml
name: Dependency Lifecycle Check

on:
  pull_request:
  push:
    branches: [main]

jobs:
  ebb:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check Packages with Ebb
        uses: velella-sh/ebb@v0
        with:
          purls: |
            pkg:npm/request@2.88.2
            pkg:generic/node@22.0.0
          fail-on: deprecated
```

### 2. Check CycloneDX SBOM or Component List

```yaml
name: SBOM Lifecycle Check

on:
  pull_request:

jobs:
  sbom-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Audit SBOM
        uses: velella-sh/ebb@v0
        with:
          file: bom.json
          fail-on: unsupported
```

### 3. Enrich an SBOM

Use the Ebb release that includes SBOM enrichment. The Action reads the
local JSON SBOM, writes a separate file and adds counts to the job summary.

```yaml
- name: Enrich the SBOM
  uses: velella-sh/ebb@v0.2.2
  with:
    sbom: bom.json
    sbom-output: bom.enriched.json
```

Use `sbom` on its own. The `purls` and `file` inputs run the failure
threshold check. The enrichment mode preserves the source file and writes
the result locally for the next workflow step.

## Inputs

| Input | Description | Default |
| :--- | :--- | :--- |
| `purls` | Newline or space separated PURLs to check. | `""` |
| `file` | Path to CycloneDX SBOM, JSON list, or text file. | `""` |
| `fail-on` | Severity threshold to fail the job (`scheduled`, `deprecated`, `unsupported`, `end-of-life`, `removed`, `error`, `none`). | `"deprecated"` |
| `sbom` | Path to a CycloneDX or SPDX JSON SBOM to enrich. | `""` |
| `sbom-output` | Output path in enrichment mode. | `"ebb-enriched-sbom.json"` |
| `as-of` | Reference date (YYYY-MM-DD) for calculating remaining days on scheduled lifecycles. | Current date |
| `no-hint` | Deprecated (no-op). | `"false"` |
