---
title: "Evidence Sources and Provenance"
description: "Inspect authoritative evidence sources, archive snapshot URLs, health status, and review provenance for lifecycle rules using sourcesOf() and the ebb sources CLI command."
layout: doc
permalink: /sources/
---

# Evidence Sources and Provenance

Every decision and date recorded in Ebb traces directly back to authoritative vendor documentation, release notes, or security announcements. `sourcesOf(ruleId, options?)` inspects the evidence behind any registered lifecycle rule, including Wayback Machine archives, source health status, and maintainer review dates.

```ts
import { sourcesOf } from "@velella/ebb";
```

> [!NOTE]
> Every lifecycle rule is maintained under Ebb's trust model: evidence sources are checked against `sources.lock.json`, verified, archived, and periodically reviewed.

---

## TypeScript API

### Basic usage

```ts
import { sourcesOf } from "@velella/ebb";

const ruleSources = sourcesOf("npm.package.request.deprecated");

console.log(`Rule: ${ruleSources.ruleId}`);
console.log(`Title: ${ruleSources.title}`);
console.log(`Reviewed by ${ruleSources.reviewer} on ${ruleSources.reviewedAt}`);

for (const source of ruleSources.sources) {
  console.log(`- [${source.health}] ${source.title}`);
  console.log(`  URL: ${source.url}`);
  if (source.archiveUrl) {
    console.log(`  Archive: ${source.archiveUrl}`);
  }
}
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `asOf` | `string` | `undefined` | Reference date (`YYYY-MM-DD`). Rules observed after this date are hidden, producing a `rule-not-found` error. |
| `rules` | `RegistryV2Rule[]` | `undefined` | Custom rule set to inspect instead of bundled registries. |
| `registries` | `RegistryV2[]` | `undefined` | Custom registries to inspect. |

### Return value

`sourcesOf()` returns a `SourcesOfResult` object:

```ts
export interface SourcesOfResult {
  readonly ruleId: string;
  readonly ecosystem: string;
  readonly purl: string;
  readonly event: LifecycleEvent;
  readonly title: string;
  readonly summary: string;
  readonly severity: Severity;
  readonly reviewer: string;
  readonly reviewedAt: string;
  readonly observedAt: string;
  readonly sources: readonly SourceEntry[];
  readonly deadline?: string | undefined;
  readonly replacement?: string | undefined;
}
```

Each source in `sources` contains:

```ts
export interface SourceEntry {
  readonly title: string;
  readonly url: string;
  readonly accessedAt?: string | undefined;
  readonly archiveUrl?: string | undefined;
  readonly health: "ok" | "unreachable" | "changed" | "blocked" | "unrecorded" | "unknown";
  readonly status: "ok" | "unreachable" | "changed" | "blocked" | "unrecorded" | "unknown";
}
```

### Time travel with `asOf`

You can evaluate rule sources as of a specific calendar date via `sourcesOf(ruleId, { asOf })` or using the scoped `asOf(date)` client:

```ts
import { asOf } from "@velella/ebb";

const client = asOf("2027-01-01");
const sources = client.sourcesOf("npm.package.request.deprecated");
```

---

## Command-Line Interface (CLI)

Use `ebb sources <rule-id>` to view evidence sources directly from your terminal:

```bash
ebb sources npm.package.request.deprecated
```

### Example output (text)

```text
Rule: npm.package.request.deprecated
Ecosystem: npm
PURL: pkg:npm/request
Event: deprecated
Title: request is deprecated
Reviewer: arminazimi (reviewed: 2026-10-14, observed: 2026-10-13)

Sources (1):
1. request package deprecation notice [unrecorded]
   URL: https://www.npmjs.com/package/request
   Accessed: 2026-10-13
```

### Formatting options

```bash
# Markdown formatted report
ebb sources npm.package.request.deprecated --format markdown

# JSON output for automated pipelines
ebb sources npm.package.request.deprecated --json

# Time-travel evaluation
ebb sources npm.package.request.deprecated --as-of 2027-01-01
```

---

## Error Handling

When given an unknown or non-existent rule ID, `sourcesOf` throws a typed `EbbError` with reason code `"rule-not-found"`:

```ts
import { sourcesOf, EbbError } from "@velella/ebb";

try {
  sourcesOf("unknown.package.id");
} catch (err) {
  if (err instanceof EbbError && err.code === "rule-not-found") {
    console.error("Unknown rule:", err.message);
  }
}
```

---

## Source Health and Link Checking

Every lifecycle rule in Ebb cites authoritative sources (vendor release notices, support policies, deprecation schedules). To prevent link rot and silent upstream alterations, Ebb continually validates the health and accuracy of all cited evidence.

### Health Statuses

Each evidence URL tracked in `registry/sources.lock.json` has a health status:

| Status | Meaning |
|---|---|
| `ok` | The page is reachable (HTTP 200), unchanged, and confirms the rule claims. |
| `changed` | The page was retitled, permanently redirected to another page, or no longer mentions the targeted version. |
| `unreachable` | The server returned an HTTP error (404, 500) or connection timed out. |
| `blocked` | The source returned a bot challenge (Cloudflare, Oracle challenge, 403), unverified by automated crawlers. |
| `unrecorded` | A new source cited in a rule but not yet locked in `registry/sources.lock.json`. |

### Automated Weekly Audits

The weekly GitHub Actions workflow audits every source URL:

1. **Backoff and Rate Limiting:** Requests respect `Retry-After` HTTP headers and retry transient failures (HTTP 429, 503) using exponential backoff.
2. **Redirect & Relocation Tracking:** Detects when a source URL permanently redirects to a different document or domain.
3. **Version Mention Verification:** Verifies that the content of the target page still references the version numbers or components covered by the rule.
4. **Dead Source Issue Tracking:** When a source URL becomes dead (e.g. HTTP 404), the workflow opens an issue labeled `good first issue`, `help wanted`, and `area: data` with deduplication markers (`<!-- ebb:dead-source:<hash> -->`) so contributors can locate updated links or Wayback Machine archive snapshots.

### Running Locally

To check source health locally:

```bash
npm run build
node dist/tools/check-sources.js
```

To update `registry/sources.lock.json` after reviewing reported changes:

```bash
node dist/tools/check-sources.js --update-lock
```

