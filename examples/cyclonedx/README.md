# Checking CycloneDX SBOMs with Ebb

This example demonstrates how to evaluate software components inside a [CycloneDX](https://cyclonedx.org/) Software Bill of Materials (SBOM) against Ebb's lifecycle rules.

## Overview

Software Bill of Materials (SBOM) generation is a key step in secure supply-chain pipelines. While vulnerability scanners inspect SBOMs for CVEs, Ebb analyzes SBOMs for deprecated, unsupported, or end-of-life dependencies before packages are abandoned or break compatibility.

Ebb has native built-in support for CycloneDX JSON documents in both its CLI and TypeScript API.

## Running with Ebb CLI

Pass the SBOM directly to `ebb check-all`:

```bash
npx @velella/ebb check-all examples/cyclonedx/bom.json
```

Or enforce failure thresholds in CI pipelines (e.g. fail on `deprecated` or `end-of-life`):

```bash
npx @velella/ebb check-all examples/cyclonedx/bom.json --fail-on end-of-life --json
```

## Running Programmatically

Run the example TypeScript script:

```bash
node --experimental-strip-types examples/cyclonedx/check-sbom.ts
```

### Code Example

```ts
import { readFileSync } from "node:fs";
import { checkAll, parsePurl } from "@velella/ebb";

const bom = JSON.parse(readFileSync("bom.json", "utf-8"));

// Extract components with purls
const items = bom.components
  .filter((c) => typeof c.purl === "string")
  .map((c) => ({
    purl: c.purl,
    version: c.version ?? parsePurl(c.purl).version ?? "",
  }));

const result = checkAll(items);

console.log(`Evaluated ${result.summary.total} components.`);
for (const match of result.results.filter(r => r.status !== "ok")) {
  console.log(`Component status: ${match.status}`);
}
```
