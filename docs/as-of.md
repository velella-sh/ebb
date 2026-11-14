---
title: "Time-travel lifecycle evaluation with asOf"
description: "Evaluate package lifecycle statuses as of past or future calendar dates with deterministic replay and migration planning using asOf()."
layout: doc
permalink: /as-of/
---

# Time-travel lifecycle evaluation (`asOf`)

`asOf(date)` returns a scoped client that evaluates software lifecycle status as of any past or future calendar date (`YYYY-MM-DD` in UTC).

```ts
import { asOf } from "@velella/ebb";
```

> [!TIP]
> `asOf` operates deterministically with zero network access. Past dates replay historical registry knowledge by hiding rules observed after that date, while future dates project scheduled end-of-life announcements into expired verdicts for proactive planning.

---

## TypeScript API

### Basic usage

```ts
import { asOf } from "@velella/ebb";

// Create a client scoped to a future planning date
const planner = asOf("2028-01-01");

// Node 22 reached end-of-life on 2027-04-30
const node22 = planner.check("node", "22.11.0");
console.log(node22.status); // "end-of-life"
console.log(node22.asOf);   // "2028-01-01"
```

### Scoped client interface

`asOf(date, options?)` returns an `AsOfClient`:

```ts
export interface AsOfClient {
  readonly asOf: string;
  check(purlOrName: string, version: string): CheckResult;
  checkAll(items: Iterable<CheckAllItem>): CheckAllResult;
  rulesFor(purl: string, options?: RulesForOptions): Rule[];
  replacementFor(purl: string, version: string): string | null;
  upcoming(options?: Omit<UpcomingOptions, "asOf">): UpcomingResult;
}
```

---

## How time travel works

### 1. Future dates (Migration planning)

When `asOf` is set to a future date:
- All rules known today remain visible.
- Any `scheduled-end-of-life` rule whose `deadline` is on or before the given date is automatically judged as **`end-of-life`** (with severity `high` and `daysLeft: null`).
- Any `scheduled-end-of-life` rule whose `deadline` is after the given date remains **`scheduled`**, with `daysLeft` calculated from the future `asOf` date.

```ts
// Node 22 EOL deadline is 2027-04-30
const beforeDeadline = asOf("2027-04-29").check("node", "22.11.0");
console.log(beforeDeadline.status); // "scheduled" (1 day left)

const afterDeadline = asOf("2027-05-01").check("node", "22.11.0");
console.log(afterDeadline.status); // "end-of-life"
```

### 2. Past dates (Deterministic replay & audit compliance)

When `asOf` is set to a past date:
- **Hiding unobserved rules**: Rules whose `provenance.observedAt` date is after the given date are omitted from candidate matching.
- **Reproducibility**: Calling `asOf(date).check(...)` on historical dates reproduces the exact state of knowledge at that time, regardless of when the code executes.

```ts
// Rule observed on 2026-10-17 is hidden on 2026-10-12
const pastAudit = asOf("2026-10-12").check("node", "20.0.0");
console.log(pastAudit.status); // "ok" (not yet observed in Ebb on that day)

const laterAudit = asOf("2026-10-18").check("node", "20.0.0");
console.log(laterAudit.status); // "end-of-life"
```

### 3. Strict UTC date handling

All dates passed to `asOf` must be calendar dates in `YYYY-MM-DD` ISO format. Timezone offsets and timestamps (such as `2026-04-01T00:00:00Z`) are rejected with `EbbError("invalid-date")` to prevent ambient clock or local timezone discrepancies.

---

## Migration planning example

Assess an entire SBOM or dependency list against a future target deployment date:

```ts
import { asOf } from "@velella/ebb";

const targetDate = "2028-06-01";
const client = asOf(targetDate);

const dependencies = [
  { purl: "pkg:generic/nodejs", version: "22.11.0" },
  { purl: "pkg:npm/left-pad", version: "1.3.0" },
  { purl: "pkg:generic/python", version: "3.12.0" },
];

const batch = client.checkAll(dependencies);

console.log(`Summary as of ${targetDate}:`);
console.log(`- End of life: ${batch.summary.byStatus["end-of-life"]}`);
console.log(`- Deprecated:  ${batch.summary.byStatus.deprecated}`);
console.log(`- Clean (OK):  ${batch.summary.byStatus.ok}`);
```

---

## CLI usage

### Evaluate status as of a date

```bash
ebb as-of 2027-05-01 node 22.11.0
```

### JSON output

```bash
ebb as-of 2027-05-01 pkg:generic/nodejs@22.11.0 --json
```

### Batch check with `--as-of` flag

```bash
ebb check-all sbom.json --as-of 2028-01-01
```

---

## MCP usage

The MCP `check` and `check_all` tools accept an optional `asOf` parameter:

```json
{
  "tool": "check",
  "arguments": {
    "purl": "pkg:generic/nodejs@22.11.0",
    "asOf": "2027-05-01"
  }
}
```
