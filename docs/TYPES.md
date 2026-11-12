# TypeScript Types Reference

Ebb exports comprehensive, fully documented TypeScript types from `@velella/ebb`.

## Core Result Types

### `CheckResult`
The return shape of `check(purlOrName, version, asOf?)`.

```ts
export interface CheckResult {
  schemaVersion: 1;
  status: CheckStatus;
  matches: CheckMatch[];
  version: string;
  asOf?: string | undefined;
}
```

### `CheckStatus`
Primary verdict union for a checked component:
```ts
export type CheckStatus =
  | "ok"
  | "deprecated"
  | "unsupported"
  | "end-of-life"
  | "removed"
  | "scheduled";
```

### `CheckMatch`
Detailed match entry for an applicable rule:
```ts
export interface CheckMatch {
  ruleId: string;
  event: CheckEvent;
  date: string | null;
  daysLeft: number | null;
  replacement: string | null;
  sources: EvidenceSource[];
  reviewedAt: string;
}
```

### `CheckEvent`
All lifecycle events classified by Ebb:
```ts
export type CheckEvent =
  | "deprecated"
  | "unsupported"
  | "end-of-life"
  | "removed"
  | "scheduled";
```

## Batch Inspection Types

### `CheckAllItem`
Input specification for `checkAll`:
```ts
export interface CheckAllItem {
  purl?: string;
  name?: string;
  version: string;
  ecosystem?: string;
  asOf?: string;
}
```

### `CheckAllResult`
Output returned by `checkAll`:
```ts
export interface CheckAllResult {
  results: CheckAllEntry[];
  summary: CheckAllSummary;
}
```

### `CheckAllSummary`
Aggregated counts across the entire batch:
```ts
export interface CheckAllSummary {
  total: number;
  byStatus: Record<CheckStatus, number>;
  byEvent: Record<CheckEvent, number>;
  errors: number;
}
```

## Rule Inspection Types

### `Rule`
Complete lifecycle rule record returned by `rulesFor(purl)`:
```ts
export interface Rule {
  id: string;
  ecosystem: string;
  purl: string;
  vers: string;
  event: LifecycleEvent;
  title: string;
  summary: string;
  deadline?: string | null;
  replacement?: string | null;
  sources: EvidenceSource[];
  provenance: Provenance;
}
```
