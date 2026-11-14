---
title: Running Ebb in Deno & JSR
description: Native TypeScript and JSR usage of @velella/ebb in Deno with zero runtime dependencies.
layout: doc
permalink: /deno/
---

# Running Ebb in Deno & JSR

Ebb runs in [Deno](https://deno.com) natively and is published to [JSR](https://jsr.io/@velella/ebb) as `@velella/ebb`.

It has **zero runtime dependencies** and works with Deno's native TypeScript support, modern ES modules, and Node compatibility layer.

---

> [!TIP]
> Ebb is published to both npm and JSR (`@velella/ebb`) with first-class TypeScript types and zero runtime dependencies.

---

## Quick Start

### Installation & Import

:::code-tabs{labels='["JSR (Recommended)", "npm: Specifier"]'}
```bash
# Add from JSR
deno add jsr:@velella/ebb
```
```typescript
// Direct ESM import without prior install
import { check } from "npm:@velella/ebb";

const result = check("pkg:npm/request", "2.88.2");
console.log(result.status); // "deprecated"
```
:::

### Basic Usage

Import and evaluate package lifecycles:

```typescript
import { check, checkAll, replacementFor } from "@velella/ebb";

// Single component check
const result = check("pkg:npm/left-pad", "1.3.0");
console.log(result.status); // "deprecated"

// Replacement lookup
const replacement = replacementFor("pkg:npm/node-sass", "9.0.0");
console.log(replacement); // "pkg:npm/sass"

// Batch evaluation
const batch = checkAll([
  { purl: "pkg:npm/left-pad", version: "1.3.0" },
  { purl: "pkg:npm/react", version: "18.2.0" },
]);
console.log(batch.summary);
```

Run with standard Deno permissions:

:::terminal
$ deno run --allow-read main.ts
:::

---

## Running Fully Offline with Zero Permissions

If your Deno environment runs with strict permissions (zero `--allow-read` or sandboxed workers), import from `@velella/ebb/browser` which uses in-memory bundled data:

```typescript
import { check } from "@velella/ebb/browser";

// Zero permissions required (--allow-read NOT needed)
const result = check("pkg:npm/left-pad", "1.3.0");
console.log(result.status); // "deprecated"
```

---

## Running the Ebb CLI under Deno

You can run the Ebb CLI directly using `deno run`:

:::terminal
$ deno run --allow-read --allow-env npm:@velella/ebb check pkg:npm/left-pad@1.3.0
:::

---

## Testing with Deno

Ebb maintains automated CI tests verifying Deno compatibility across all public APIs and CLI workflows.
