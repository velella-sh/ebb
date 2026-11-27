# Ebb Pre-commit Hook Example

This example demonstrates how to integrate Ebb with [pre-commit](https://pre-commit.com/) to verify software lifecycle status in git workflows.

## Configuration

In your repository's `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/velella-sh/ebb
    rev: v0.2.1
    hooks:
      - id: ebb-sbom
      - id: ebb-purls
```

## Files in this example

- `.pre-commit-config.yaml`: Pinned pre-commit configuration with `ebb-sbom` and `ebb-purls`.
- `sbom-pass.json`: A passing CycloneDX SBOM with supported, maintained components.
- `sbom-fail.json`: A failing CycloneDX SBOM containing `left-pad@1.3.0` which reached end-of-life / removed status.
- `.ebb-purls`: A list of Package URLs checked by `ebb-purls`.
