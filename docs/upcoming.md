---
title: "Upcoming lifecycle deadlines"
description: "List scheduled and upcoming end-of-life and deprecation deadlines within a configurable time window using upcoming() and the ebb upcoming CLI command."
layout: doc
permalink: /upcoming/
---

# Upcoming lifecycle deadlines

`upcoming(options?)` queries Ebb's active lifecycle data to find upcoming software deprecation and end-of-life deadlines within a configurable time window (defaulting to 90 days).

```ts
import { upcoming } from "@velella/ebb";
```

> [!TIP]
> `upcoming` operates purely on local, verified data with zero network access and deterministic date math.

---

## TypeScript API

### Basic usage

```ts
import { upcoming } from "@velella/ebb";

const result = upcoming({ within: "90d" });

console.log(`Found ${result.count} upcoming deadlines (until ${result.until}):`);
for (const item of result.items) {
  console.log(`- ${item.deadline} (${item.daysLeft}d left) [${item.severity}] ${item.purl}: ${item.title}`);
}
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `within` | `string \| number` | `"90d"` | Time window: `"30d"`, `"2w"`, `"3m"`, `"1y"`, or number of days. |
| `ecosystem` | `string \| string[]` | `undefined` | Filter by ecosystem name (e.g. `"npm"`, `["nodejs", "python"]`). |
| `purls` | `string[]` | `undefined` | Filter by specific package URL(s) (with or without version constraints). |
| `asOf` | `string` | Today (UTC) | Reference date (`YYYY-MM-DD`) for deterministic planning and testing. |
| `rules` | `RegistryV2Rule[]` | `undefined` | Custom rule set to evaluate instead of the bundled registry. |

### Return value

`upcoming()` returns an `UpcomingResult` object:

```ts
export interface UpcomingResult {
  readonly asOf: string;
  readonly within: string;
  readonly until: string;
  readonly count: number;
  readonly items: UpcomingItem[];
}
```

Each event item contains:

```ts
export interface UpcomingItem {
  readonly ruleId: string;
  readonly purl: string;
  readonly ecosystem: string;
  readonly event: LifecycleEvent;
  readonly title: string;
  readonly severity: Severity;
  readonly deadline: string;
  readonly daysLeft: number;
  readonly estimated: boolean;
  readonly replacement: string | null;
  readonly sources: EvidenceSource[];
  readonly reviewedAt: string | null;
}
```

Events are sorted strictly by date ascending (soonest deadline first), then severity descending (`critical` > `high` > `medium` > `low` > `info`), with rule ID as tie-breaker.

---

## CLI usage

The `ebb upcoming` command provides terminal, Markdown, and JSON output:

```bash
# Default 90-day window
ebb upcoming

# Specify a 6-month window filtered by ecosystem
ebb upcoming --within 6m --ecosystem nodejs

# Filter by a specific package
ebb upcoming --purl pkg:npm/express --within 1y

# JSON output
ebb upcoming --within 30d --json

# Markdown table output
ebb upcoming --within 90d --format markdown
```

---

## MCP Resource

For AI coding agents and MCP clients, Ebb exposes the `ebb://upcoming` resource via `npx -y @velella/ebb mcp`, supporting optional `within`, `asOf`, and `ecosystem` parameters.
