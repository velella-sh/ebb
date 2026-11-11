---
title: "Result model"
description: "Fields, stability tags, and status mapping for Ebb's Result model and legacy lookupProduct output."
layout: doc
permalink: /result-model/
---

Inventory of every field the public result model (`src/result.ts`, returned by `check` as `CheckResult`) and the legacy `lookupProduct` API (`src/lookup.ts`) return. Types come from `src/result.ts`, `src/check.ts`, and `src/lookup.ts`.

Stability tags on `Result` and `ResultMatch` match the JSDoc annotations in `src/result.ts`:
- `@stable`: additive-only contract through 1.0; field name and meaning will not change incompatibly.
- `@experimental`: newly added or evolving behavior; field name, optionality, or semantics may still change before 1.0.

## `check` → `Result` (`CheckResult`)

| Field | Type | Stability | Meaning |
| --- | --- | --- | --- |
| `schemaVersion` | `1` | `@stable` | Fixed version number of this result model (`RESULT_SCHEMA_VERSION`). |
| `status` | `"ok" \| "deprecated" \| "unsupported" \| "end-of-life" \| "removed" \| "scheduled"` | `@stable` | Primary verdict. `"ok"` when no rule matches; otherwise the most serious matching event (short names; see mapping below). |
| `matches` | `ResultMatch[]` | `@stable` | Every matching rule, ordered by event seriousness then earliest date. Empty when `status` is `"ok"`. |
| `version` | `string` | `@stable` | The version argument exactly as passed to `check` (not normalised). |
| `asOf` | `string` (optional) | `@experimental` | The day `daysLeft` is measured from (`YYYY-MM-DD`), when supplied. Omitted for the two-argument call. |

### `ResultMatch` (`CheckMatch`)

| Field | Type | Stability | Meaning |
| --- | --- | --- | --- |
| `ruleId` | `string` | `@stable` | Id of the matching registry rule. |
| `event` | `"deprecated" \| "unsupported" \| "end-of-life" \| "removed" \| "scheduled"` | `@stable` | Lifecycle event on that rule, in `check`'s short form. |
| `date` | `string \| null` | `@stable` | Deadline from the rule (`YYYY-MM-DD`), or `null` when the rule has no deadline. |
| `daysLeft` | `number \| null` | `@experimental` | Whole UTC days from `asOf` until `date`; `null` when past, undated, or `asOf` is omitted. |
| `replacement` | `string \| null` | `@stable` | Suggested replacement from the rule, or `null` when none. |
| `sources` | `EvidenceSource[]` | `@stable` | Authoritative evidence pages the rule cites. |
| `reviewedAt` | `string` | `@stable` | Date (`YYYY-MM-DD`) a maintainer last reviewed the rule against its sources. |

## `lookupProduct` → `LookupResult`

| Field | Type | Meaning |
| --- | --- | --- |
| `schemaVersion` | `"ebb.lookup.v1"` | Fixed schema id for this result shape. |
| `query` | `{ name: string; version?: string }` | Echo of the caller’s arguments. `version` is omitted when the caller did not pass one. |
| `query.name` | `string` | Product name or package URL as given. |
| `query.version` | `string` (optional) | Version as given, when present. |
| `product` | `{ id: string; purl: string; name: string; ecosystems: string[] }` | The resolved product record. |
| `product.id` | `string` | Stable product id. |
| `product.purl` | `string` | Canonical package URL for the product. |
| `product.name` | `string` | Display name. |
| `product.ecosystems` | `string[]` | Ecosystems that product appears in. |
| `version` | `string` (optional) | Version as given; omitted when the caller did not pass one. |
| `status` | `LifecycleEvent \| "supported"` | Primary verdict from findings, or `"supported"` when none match. Uses registry event names (not check’s short forms). |
| `deadline` | `string` (optional) | Earliest deadline among findings that have one; omitted when none do. |
| `replacement` | `string` (optional) | Replacement from the primary finding; omitted when that finding has none. |
| `findings` | `LookupFinding[]` | Matching rules (all product rules when no version; version-filtered otherwise), sorted by deadline then rule id. |

`LifecycleEvent` is `"deprecated" \| "end-of-support" \| "end-of-life" \| "removed" \| "scheduled-end-of-life"`.

### `LookupFinding`

| Field | Type | Meaning |
| --- | --- | --- |
| `ruleId` | `string` | Id of the matching registry rule. |
| `ecosystem` | `string` | Ecosystem the rule belongs to. |
| `event` | `LifecycleEvent` | Lifecycle event on that rule (registry names). |
| `severity` | `"info" \| "low" \| "medium" \| "high" \| "critical"` | How much attention the rule assigns. |
| `title` | `string` | Short rule title. |
| `summary` | `string` | Longer rule summary. |
| `deadline` | `string` (optional) | Rule deadline when present. |
| `replacement` | `string` (optional) | Suggested replacement when present. |
| `affectedVersions` | `string` | The rule’s `vers` range string. |
| `sources` | `EvidenceSource[]` | Authoritative evidence pages the rule cites. |

## Shared: `EvidenceSource`

Defined in `src/domain.ts` and used by both `ResultMatch.sources` and `LookupFinding.sources`.

| Field | Type | Meaning |
| --- | --- | --- |
| `title` | `string` | Name of the evidence page. |
| `url` | `string` | URL of that page. |
| `accessedAt` | `string` (optional) | Day the page was reviewed (`YYYY-MM-DD`). |

## Status name mapping

`check` shortens two registry events; `lookupProduct` keeps the registry names and uses `"supported"` / `"ok"` differently for “nothing matched”:

| Registry / `lookupProduct` status | `check` status |
| --- | --- |
| `"supported"` (no match) | `"ok"` (no match) |
| `"deprecated"` | `"deprecated"` |
| `"end-of-support"` | `"unsupported"` |
| `"end-of-life"` | `"end-of-life"` |
| `"removed"` | `"removed"` |
| `"scheduled-end-of-life"` | `"scheduled"` |
