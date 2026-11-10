# Result model today: `check` and `lookupProduct`

Inventory of every field the two public lookup APIs return today, before the stable result model in [#110](https://github.com/velella-sh/ebb/issues/110). Types come from `src/check.ts` and `src/lookup.ts`. Nested objects are expanded so each leaf field appears once.

This page does not define the future model; it only records what ships now.

## `check` → `CheckResult`

| Field | Type | Meaning |
| --- | --- | --- |
| `status` | `"ok" \| "deprecated" \| "unsupported" \| "end-of-life" \| "removed" \| "scheduled"` | Primary verdict. `"ok"` when no rule matches; otherwise the most serious matching event (short names; see mapping below). |
| `matches` | `CheckMatch[]` | Every matching rule, ordered by event seriousness then earliest date. Empty when `status` is `"ok"`. |
| `version` | `string` | The version argument exactly as passed to `check` (not normalised). |

### `CheckMatch`

| Field | Type | Meaning |
| --- | --- | --- |
| `ruleId` | `string` | Id of the matching registry rule. |
| `event` | `"deprecated" \| "unsupported" \| "end-of-life" \| "removed" \| "scheduled"` | Lifecycle event on that rule, in check's short form. |
| `date` | `string \| null` | Deadline from the rule (`YYYY-MM-DD`), or `null` when the rule has no deadline. |
| `replacement` | `string \| null` | Suggested replacement from the rule, or `null` when none. |
| `sources` | `EvidenceSource[]` | Authoritative evidence pages the rule cites. |

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

Used by both `CheckMatch.sources` and `LookupFinding.sources`.

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
