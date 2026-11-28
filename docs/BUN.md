---
title: Running Ebb in Bun
description: Native zero-dependency execution and subpath support in Bun.
layout: doc
permalink: /bun/
---

# Running Ebb in Bun

Ebb runs natively in [Bun](https://bun.sh) with **zero runtime dependencies** and full feature parity with Node.js.

All APIs (`check`, `checkAll`, `rulesFor`, `replacementFor`, `createEbb`), CLI commands, and batch operations execute with ultra-fast startup times.

---

> [!TIP]
Ebb has zero runtime dependencies. The published [benchmark measurements](https://velella.sh/ebb/benchmarks/) cover Node.js.

---

## Quick Start

### Installation

:::terminal
$ bun add @velella/ebb
:::

### Basic Usage

Create an `index.ts` file:

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

Run with Bun:

:::terminal
$ bun run index.ts
:::

---

## Running the CLI with `bunx`

Run the Ebb CLI instantly with `bunx` without installing:

:::terminal
$ bunx @velella/ebb check pkg\:npm/left-pad@1.3.0
$ bunx @velella/ebb check package.json
:::

---

## Performance in Bun

Bun startup and throughput can be measured with your own dependency set and deployment environment.
