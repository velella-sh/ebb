# Running Ebb in Bun

Ebb runs natively in [Bun](https://bun.sh) with **zero runtime dependencies** and full feature parity with Node.js.

All APIs (`check`, `checkAll`, `rulesFor`, `replacementFor`, `createEbb`), CLI commands, and batch operations execute with ultra-fast startup times.

---

## Quick Start

### Installation

Install `@velella/ebb` using `bun add`:

```bash
bun add @velella/ebb
```

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

// Batch evaluation (1,000 components in < 1ms)
const batch = checkAll([
  { purl: "pkg:npm/left-pad", version: "1.3.0" },
  { purl: "pkg:npm/react", version: "18.2.0" },
]);
console.log(batch.summary);
```

Run with Bun:

```bash
bun run index.ts
```

---

## Running the CLI with `bunx`

You can run the Ebb CLI instantly with `bunx` without installing:

```bash
bunx @velella/ebb check pkg:npm/left-pad@1.3.0
```

Or for batch checks:

```bash
bunx @velella/ebb check package.json
```

---

## Performance in Bun

Ebb's zero-dependency footprint and pre-indexed lifecycle data allow cold start under Bun in less than 20 ms, with batch evaluations executing at tens of thousands of operations per second.
