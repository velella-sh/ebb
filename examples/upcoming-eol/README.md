# Forecasting Upcoming End-of-Life Deadlines with Ebb

This example demonstrates how to proactively plan infrastructure and dependency migrations by calculating remaining days before scheduled end-of-life (EOL) deadlines.

## Overview

Software deprecations and end-of-life milestones are predictable: runtimes (Node.js, Python, Go) and frameworks (Django, Ubuntu, Kubernetes) publish strict support cadences months or years in advance.

Ebb provides an `asOf` parameter on `check()` that automatically populates `daysLeft` for any scheduled or deadline-driven rule, enabling automated quarterly tech-debt reviews and sprint planning.

## Running the Example

Run with default parameters (forecast horizon: 180 days):

```bash
node --experimental-strip-types examples/upcoming-eol/upcoming-eol.ts
```

Or customize the reference date and horizon window:

```bash
node --experimental-strip-types examples/upcoming-eol/upcoming-eol.ts --as-of=2026-06-01 --days=90
```

## How It Works

Pass the reference date string (`YYYY-MM-DD`) as the third argument to `check()`:

```ts
import { check } from "@velella/ebb";

// Evaluates Node 20 as of 2026-01-01
const result = check("node", "20.0.0", "2026-01-01");

for (const match of result.matches) {
  console.log(`Event: ${match.event}`);       // "end-of-life"
  console.log(`Deadline: ${match.date}`);     // "2026-04-30"
  console.log(`Days left: ${match.daysLeft}`); // 119
}
```

## CLI Alternative

The CLI accepts `--as-of <YYYY-MM-DD>`:

```bash
npx @velella/ebb check node 20.0.0 --as-of 2026-01-01
```
