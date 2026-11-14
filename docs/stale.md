---
title: "Stale rule review"
description: "Find lifecycle rules whose review window has expired with stale(), the ebb stale CLI, and the weekly stale-rules workflow."
layout: doc
permalink: /stale/
---

# Stale rule review

`stale(options?)` lists lifecycle rules whose last maintainer review is older than the registry's freshness window, and rules that will cross that window soon. Scanning a repository never calls this — only maintainers, CI, and the weekly issue do.

```ts
import { stale } from "@velella/ebb";
```

> [!TIP]
> Pass `asOf` or `clock` in tests so the report never depends on wall-clock time.

---

## Review policy

1. **Every rule has a review window.** Registries declare `freshness.maxReviewAgeDays` (default **365** when omitted). A rule is stale when `ageDays > maxReviewAgeDays`, matching `registry.staleRules`.
2. **`provenance.reviewedAt` is the clock.** Update it only after a human re-checks the rule against its sources.
3. **Reading data never marks rules stale.** Freshness is a maintainer signal, not part of `check()` results.
4. **Target: zero stale rules on `main`.** The weekly workflow opens one issue when any rule is stale or will become stale within 30 days. Claim a checkbox, verify the source, bump `reviewedAt`, and open a small PR.
5. **Do not bulk-bump dates.** A review without reading the source is not a review.

As of the v0.4.0 `stale` work, the bundled registries report **0** stale rules at a fixed `asOf` of `2026-11-14`.

---

## TypeScript API

```ts
import { stale } from "@velella/ebb";

const report = stale({ asOf: "2026-11-14" });

console.log(`${report.counts.stale} stale, ${report.counts.staleSoon} soon`);
for (const entry of report.stale) {
  console.log(`- ${entry.ruleId} reviewed ${entry.reviewedAt} (${entry.ageDays}d / ${entry.maxReviewAgeDays}d)`);
}
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `olderThan` | `string \| number` | per-registry | Override every registry window (`90`, `"90d"`, `"2w"`, …). |
| `asOf` | `string` | UTC today | Reference day (`YYYY-MM-DD`). |
| `clock` | `() => Date` | `() => new Date()` | Used only when `asOf` is omitted. |
| `rules` | `RegistryV2Rule[]` | bundled | Injected rules (tests). |
| `registries` | `RegistryV2[]` | bundled | Supplies rules and `maxReviewAgeDays`. |
| `maxReviewAgeDays` | `number \| Record<string, number>` | — | Override when injecting rules without registries. |
| `soonWithin` | `string \| number` | `30` | How far ahead `staleSoon` looks. |

### Return value

```ts
export interface StaleResult {
  readonly schemaVersion: "ebb.stale.v1";
  readonly asOf: string;
  readonly olderThan: string | null;
  readonly soonWithin: string;
  readonly stale: readonly StaleFinding[];
  readonly staleSoon: readonly StaleFinding[];
  readonly counts: {
    readonly stale: number;
    readonly staleSoon: number;
    readonly fresh: number;
    readonly total: number;
  };
}
```

---

## CLI usage

```bash
# Use each registry's freshness window
ebb stale

# Fixed day for reproducible CI
ebb stale --as-of 2026-11-14

# Override the window
ebb stale --older-than 90d --json

# How far ahead "soon" looks (default 30d)
ebb stale --within 14d --format markdown
```

Exit code `1` when at least one rule is already stale; `0` when the list is empty (soon-only still exits `0`).

---

## Weekly workflow

[`.github/workflows/stale-rules.yml`](https://github.com/velella-sh/ebb/blob/main/.github/workflows/stale-rules.yml) runs every Monday, writes `stale-rules.json` for the badge endpoint, and opens or updates **one** issue labeled `good first issue` with the stale and soon-stale checklists.

The shields endpoint file is `stale-rules.json` (produced by `npm run badges` / the Badges workflow).
