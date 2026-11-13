# Checking a `package.json` File with Ebb

This example demonstrates how to evaluate dependencies from a `package.json` file against Ebb's lifecycle rules.

## Overview

When maintaining Node.js applications, dependencies often reach end-of-life or become deprecated without triggering standard security alerts (CVEs). Ebb catches these lifecycle transitions before they break builds or leave applications unsupported.

## Running the Example

Run the inspection script using Node.js (v22+):

```bash
node --experimental-strip-types examples/package-json/check.ts
```

Or pass a custom `package.json` file:

```bash
node --experimental-strip-types examples/package-json/check.ts ./path/to/package.json
```

## How It Works

The script reads `dependencies` and `devDependencies`, constructs standard Package URLs (`pkg:npm/<package>@<version>`), and calls `checkAll()`:

```ts
import { readFileSync } from "node:fs";
import { checkAll, replacementFor } from "@velella/ebb";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

const items = Object.entries(deps).map(([name, verRange]) => ({
  purl: `pkg:npm/${name}`,
  version: verRange.replace(/^[^0-9]*/, ""),
}));

const result = checkAll(items);

for (const finding of result.results.filter(r => r.status !== "ok")) {
  console.log(`Warning: ${finding.purl} is ${finding.status}`);
}
```

## Running with Ebb CLI

You can also extract dependencies and pipe them straight into the `ebb check-all` CLI:

```bash
node -e '
  const pkg = require("./package.json");
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [k, v] of Object.entries(deps)) {
    console.log(`pkg:npm/${k}@${v.replace(/^[^0-9]*/, "")}`);
  }
' | npx @velella/ebb check-all --fail-on deprecated
```
