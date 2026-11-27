# Xeol Migration Example

This example demonstrates replacing the deprecated `xeol` scanner with `syft` and `ebb`.

## Files

- `workflow.yml`: GitHub Actions workflow showing SBOM generation with `anchore/sbom-action` followed by lifecycle checking with `ebb`.
- `check-syft.ts`: Local script evaluating a Syft JSON document using the `@velella/ebb` library API and producing xeol-compatible JSON.

## Running Locally

```bash
# Generate a Syft SBOM
syft alpine:3.14 -o json > sbom.syft.json

# Run evaluation script
node --experimental-strip-types examples/xeol/check-syft.ts sbom.syft.json

# Or directly with Ebb CLI
npx @velella/ebb check-all sbom.syft.json --format xeol-json
```
