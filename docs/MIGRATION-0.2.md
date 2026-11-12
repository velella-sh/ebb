# Migrating to Ebb 0.2.0

Ebb 0.2.0 establishes the stable Core API, locks down public entry points, eliminates external semver parsing in favor of native VERS, and provides batch evaluation.

## What Changed

1. **Root Entry Point:** All primary functions and types are now exported directly from `@velella/ebb`. Deep subpath imports (such as `@velella/ebb/check.js`) are deprecated and will be removed in 1.0.
2. **Stable Result Model:** Every call to `check` returns a versioned `CheckResult` object (`schemaVersion: 1`) with a normalized `status`, typed `matches`, and authoritative `sources`.
3. **Batch Checking:** `checkAll` provides high-throughput batch evaluation with deduplication and an aggregated summary.
4. **Native VERS Engine:** The external `semver` dependency has been removed. All version ranges adhere to the official VERS specification.

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

### 4. Fetching Modern Replacements

```ts
import { replacementFor } from "@velella/ebb";

const alt = replacementFor("pkg:npm/request", "2.88.2");
// Returns: "Native fetch or a maintained HTTP client"
```
