---
title: "Pre-commit Hook"
description: "Check committed SBOMs and Package URL lists for software end-of-life in git pre-commit workflows."
layout: doc
permalink: /pre-commit/
---

# Pre-commit Hook

Ebb provides lifecycle hooks for [pre-commit](https://pre-commit.com/) to verify that dependencies in committed SBOM files or Package URL lists have not reached end-of-life.

## Quickstart

Add Ebb to your repository's `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/velella-sh/ebb
    rev: v0.2.1
    hooks:
      - id: ebb-sbom
```

You can also include `ebb-purls` if you maintain an explicit `.ebb-purls` list:

```yaml
repos:
  - repo: https://github.com/velella-sh/ebb
    rev: v0.2.1
    hooks:
      - id: ebb-sbom
      - id: ebb-purls
```

## Generating an SBOM Before the Hook

Reading package manifests (such as `package.json`, `pom.xml`, or `requirements.txt`) and lockfiles directly is intentionally out of scope for Ebb. Ebb evaluates canonical Package URLs (PURLs) from standard Software Bill of Materials (SBOM) documents.

Before the pre-commit hook runs, generate an SBOM using your preferred SBOM generator:

### With Syft

```bash
# CycloneDX JSON
syft dir:. -o cyclonedx-json=bom.json

# SPDX JSON
syft dir:. -o spdx-json=sbom.spdx.json
```

### With CycloneDX CLI

```bash
# For Node.js / npm projects
npx @cyclonedx/cyclonedx-npm --output-file bom.json

# For Python projects
cyclonedx-py poetry -o bom.json
```

Commit the generated SBOM alongside your code changes so the hook can evaluate your dependency graph.

## Available Hooks

### `ebb-sbom`

Evaluates committed SBOM files for lifecycle risks.

- **Files matched**: Committed JSON files matching the pattern `(?i)(^|/)(.*sbom.*\.json|bom\.json|.*cyclonedx.*\.json|.*spdx.*\.json|.*syft.*\.json)$`.
- **Supported formats**: CycloneDX JSON (1.4+), SPDX 2.x JSON, SPDX 3 JSON-LD, and Syft JSON.
- **Default failure level**: `end-of-life`.

### `ebb-purls`

Evaluates a plain list of Package URLs committed in `.ebb-purls`.

- **Files matched**: Files named `.ebb-purls`.
- **Format**: Plain text with one PURL per line (empty lines and `#` comments are ignored).
- **Default failure level**: `end-of-life`.

## Hook Options and Arguments

Both hooks default to `--fail-on end-of-life`. You can customize the threshold or pass additional CLI options using `args`:

```yaml
repos:
  - repo: https://github.com/velella-sh/ebb
    rev: v0.2.1
    hooks:
      - id: ebb-sbom
        args: [--fail-on, deprecated]
```

### Supported Thresholds

- `scheduled`: Fails on scheduled future end-of-life, deprecated, unsupported, end-of-life, and removed packages.
- `deprecated`: Fails on deprecated, unsupported, end-of-life, and removed packages.
- `unsupported`: Fails on unsupported, end-of-life, and removed packages.
- `end-of-life`: (Default) Fails only when packages have reached official end-of-life or removal.
- `none`: Warns about lifecycle findings without failing the pre-commit check.

### Time-Travel Evaluation

Pass `--as-of` to evaluate lifecycle status relative to a specific target date (for instance, planning a release):

```yaml
repos:
  - repo: https://github.com/velella-sh/ebb
    rev: v0.2.1
    hooks:
      - id: ebb-sbom
        args: [--fail-on, end-of-life, --as-of, "2026-12-31"]
```

## Example Repository

See [examples/pre-commit/](https://github.com/velella-sh/ebb/tree/main/examples/pre-commit) for an example configuration with passing and failing SBOM fixtures.
