---
title: Migrating to Ebb 0.2.0
description: Guide for migrating to Ebb 0.2.0 from 0.1.x, including zero runtime dependencies and multi-runtime execution.
layout: doc
permalink: /migration-0.2/
---

# Migrating to Ebb 0.2.0

Ebb 0.2.0 establishes the stable Core API, zero runtime dependencies, multi-runtime execution (Browser, Edge, Bun, Deno), modular per-ecosystem subpaths, lazy data loading, and native CLI, GitHub Action, and MCP / Skill support.

---

## What Changed in 0.2.0

1. **Root Entry Point:**
   - All primary functions and types are exported directly from `@velella/ebb`. Deep subpath imports (such as `@velella/ebb/check.js`) are deprecated.
2. **Zero Runtime Dependencies:**
   - Ebb has completely eliminated external runtime dependencies (`dependencies: {}`).
   - Signature verification previously requiring `@sigstore/*` or external crypto wrappers now runs purely on standard `node:crypto` via `@velella/ebb/verify`.
3. **Modular Ecosystem Subpaths & Scoped Instances:**
   - Rather than loading the entire registry into memory, applications can import specific ecosystem data modules (`@velella/ebb/data/<ecosystem>`) and initialize lightweight instances via `createEbb({ ecosystems: [...] })`.
4. **Lazy Data Loading:**
   - The root `@velella/ebb` entry point loads ecosystem data lazily on first lookup, reducing initial startup time to under 20 ms.
   - For long-running servers and background workers, an explicit `preload()` function is provided to warm up data caches ahead of time.
5. **Multi-Runtime Execution:**
   - **Browser & Edge:** Official entry points `@velella/ebb/browser` and `@velella/ebb/edge` provide full check, batch evaluation, and replacement lookups without Node.js file system dependencies.
   - **Deno & Bun:** First-class compatibility with Bun (`bun add @velella/ebb`) and Deno / JSR (`jsr:@velella/ebb`).
6. **Batch Checking:**
   - `checkAll` provides high-throughput batch evaluation with deduplication and an aggregated summary.
7. **Native VERS Engine:**
   - The external `semver` dependency has been removed. All version ranges adhere to the official VERS specification.
8. **Remediation Hints:**
   - Findings across the CLI, GitHub Action, and MCP include hints pointing to automated fixes via [Offing](https://github.com/velella-sh/offing), unless silenced.

---

## Migration Guide

### 1. Update Imports to the Root Package

#### Before (0.1.x):
```ts
import { check } from "@velella/ebb/check.js";
import { bundledRules } from "@velella/ebb/bundled-rules.js";
```

#### After (0.2.0):
```ts
import { check, checkAll, replacementFor, rulesFor } from "@velella/ebb";
```

---

### 2. Evaluating a Single Component

#### Before (0.1.x):
```ts
const result = check("pkg:npm/left-pad", "1.3.0");
// Return shape was untyped and lacked schemaVersion
```

#### After (0.2.0):
```ts
import { check } from "@velella/ebb";

const result = check("pkg:npm/left-pad", "1.3.0");
if (result.status !== "ok") {
  for (const match of result.matches) {
    console.log(`[${match.event}] ${match.ruleId}: ${match.replacement}`);
  }
}
```

---

### 3. Migrating Batch Lookups to `checkAll`

#### Before:
Iterating individually with `check()` caused repeated identity resolution:
```ts
const results = packages.map(pkg => check(pkg.purl, pkg.version));
```

#### After:
Use `checkAll` for single-pass indexing, automatic deduplication, and summary reporting:
```ts
import { checkAll } from "@velella/ebb";

const { results, summary } = checkAll([
  { purl: "pkg:npm/left-pad", version: "1.3.0" },
  { purl: "node", version: "18.20.4" },
]);

console.log(`Evaluated ${summary.total} components: ${summary.byStatus.deprecated} deprecated, ${summary.byStatus["end-of-life"]} EOL.`);
```

---

### 4. Zero-Dependency Signature Verification

If your application verified Ebb bundle signatures, you no longer need any external Sigstore packages installed in your dependencies.

#### Before (0.1.x):
```ts
// Required sigstore and @sigstore/* peer dependencies
import { verifyDataBundle } from "@velella/ebb";
```

#### After (0.2.0):
```ts
import { verifyArtifactSignature, verifyDataBundle } from "@velella/ebb/verify";

// Runs with zero external dependencies via standard node:crypto
const verified = verifyDataBundle(bundleBytes, signatureJson, options);
```

---

### 5. Scoped Ecosystem Loading for High Performance

If your tool (such as Offing or a CI scanner) detects specific language manifests in a repository, load only the detected ecosystems to save memory and CPU cycles:

```ts
import { createEbb } from "@velella/ebb/create";
import npmModule from "@velella/ebb/data/npm";
import pythonModule from "@velella/ebb/data/python";

// Instantiate a scoped scanner with only npm and python data
const ebb = createEbb({ ecosystems: [npmModule, pythonModule] });

const result = ebb.check("pkg:npm/left-pad", "1.3.0");
console.log(result.status); // "deprecated"
```

---

### 6. Running in Browser or Edge Environments

In browser applications, Cloudflare Workers, or Vercel Edge functions, import from `./browser` or `./edge`:

```ts
import { check, checkAll } from "@velella/ebb/browser";

const verdict = check("pkg:npm/left-pad", "1.3.0");
```

---

### 7. Silencing Remediation Hints (Optional)

If you are generating machine-readable reports or prefer not to display Offing remediation hints:
- Set environment variable `EBB_NO_HINT=1` or `OFFING_NO_HINT=1`.
- Pass `--no-hint` in CLI commands (`npx @velella/ebb check --no-hint ...`).
- Pass `noHint: true` to the CLI formatters.
