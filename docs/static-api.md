---
title: Static Lifecycle API (v1)
description: Public static zero-dependency JSON API on GitHub Pages for component and ecosystem lifecycle rules.
layout: doc
permalink: /static-api/
---

# Ebb Static Lifecycle API (v1)

Ebb provides a public, static, zero-dependency JSON API hosted directly on GitHub Pages at `https://velella.sh/ebb/api/v1/`.

Every component, ecosystem, and index file is pre-generated from the active rules in `registry/` on every commit to `main`. You can query any package lifecycle with standard tools like `curl`, `jq`, or modern `fetch()` without installing any npm package or running a server.

---

> [!TIP]
> The static API requires zero server compute or database dependencies. All JSON files are statically hosted on GitHub Pages and can be cached indefinitely with ETags.

---

## URL Layout

Base URL: `https://velella.sh/ebb/api/v1`

| Endpoint | Description | Example |
| :--- | :--- | :--- |
| `/<type>/<name>.json` | Lifecycle rules for a specific component | `/npm/request.json` |
| `/<type>/<namespace>/<name>.json` | Scoped or namespaced component | `/npm/@angular/core.json` |
| `/<ecosystem>.json` | All rules for a specific ecosystem | `/npm.json` |
| `/ecosystems/<ecosystem>.json` | Ecosystem alias | `/ecosystems/npm.json` |
| `/all.json` | All active rules across all ecosystems | `/all.json` |
| `/index.json` | Global catalog mapping every component to its URL and content hash | `/index.json` |
| `/ecosystems.json` | Catalog of all ecosystems with rule and component counts | `/ecosystems.json` |
| `/upcoming.json` | Scheduled deprecations and end-of-life dates, sorted by deadline | `/upcoming.json` |
| `/predictions.json` | Optional end-of-life ranges from vendor policy and release history | `/predictions.json` |
| `/recent.json` | Most recently reviewed and updated rules, sorted by date | `/recent.json` |
| `/search-index.json` | Compact prefix search index for fast component autocomplete | `/search-index.json` |
| `/rules/<rule-id>.json` | Full lifecycle rule with evidence sources and provenance | `/rules/npm.package.request.deprecated.json` |
| `/releases.json` | History of signed data releases with version, date, digest, and change counts | `/releases.json` |
| `/meta.json` | Catalog metadata: data version, package version, rule counts, and schema versions | `/meta.json` |
| `/openapi.json` | OpenAPI 3.1 specification describing the static API | `/openapi.json` |
| `/calendar/all.ics` | Deadlines from the last 30 days and the next 24 months | `/calendar/all.ics` |
| `/calendar/<ecosystem>.ics` | That window for one ecosystem | `/calendar/npm.ics` |
| `/calendar/<type>/<name>.ics` | One component, only when a deadline is still ahead | `/calendar/generic/nodejs.ics` |
| `/renovate/<type>/<name>.json` | Release lines and deprecation flags formatted for Renovate custom datasources | `/renovate/generic/nodejs.json` |

---

The versioned API exposes optional [end-of-life predictions](predict.md) in `predictions.json`. The index's `predictions` field records its relative path, SHA-256 and snapshot data version.

## Client Initialization (`meta.json`)

Clients should call `/meta.json` as the very first request before querying individual components. It states the current `dataVersion`, package `version`, rule and component totals, and the active schema versions:

:::terminal
$ curl -s https://velella.sh/ebb/api/v1/meta.json | jq .
:::

Output:
```json
{
  "$schema": "https://velella.sh/ebb/api/v1/schemas/static-api.v1.schema.json",
  "schemaVersion": "ebb.api.v1",
  "version": "0.3.0",
  "dataVersion": "2026.11.12",
  "rulesCount": 830,
  "componentsCount": 420,
  "ecosystemsCount": 26,
  "schemaVersions": {
    "api": "ebb.api.v1",
    "registry": "ebb.registry.v2",
    "rule": "ebb.rule.v2",
    "result": 1
  }
}
```

Clients can compare `dataVersion` against their local cache to detect if data has changed without downloading full rule catalogs.

---

## Curl Examples

### 1. Check a Component
Fetch all active lifecycle rules and migration hints for a package:

:::terminal
$ curl -s https://velella.sh/ebb/api/v1/npm/request.json | jq .
:::

Output:
```json
{
  "$schema": "https://velella.sh/ebb/api/v1/schemas/static-api.v1.schema.json",
  "schemaVersion": "ebb.api.v1",
  "version": "0.3.0",
  "generatedAt": "2026-11-12T00:00:00.000Z",
  "purl": "pkg:npm/request",
  "type": "npm",
  "name": "request",
  "ecosystems": ["npm", "osv"],
  "rules": [
    {
      "id": "npm.package.request.deprecated",
      "ecosystem": "npm",
      "purl": "pkg:npm/request",
      "vers": "vers:npm/*",
      "event": "deprecated",
      "title": "request is deprecated",
      "summary": "The package is fully deprecated and no new changes are expected.",
      "severity": "high",
      "replacement": "Native fetch or a maintained HTTP client",
      "deadline": "2020-02-11",
      "url": "https://velella.sh/ebb/api/v1/rules/npm.package.request.deprecated.json"
    }
  ],
  "replacements": [
    {
      "purl": "pkg:npm/undici",
      "name": "undici",
      "kind": "alternative",
      "note": "Modern HTTP/1.1 client for Node.js"
    },
    {
      "purl": "pkg:npm/axios",
      "name": "axios",
      "kind": "alternative",
      "note": "Promise-based HTTP client"
    },
    {
      "purl": "pkg:npm/got",
      "name": "got",
      "kind": "alternative",
      "note": "Human-friendly HTTP request library for Node.js"
    }
  ],
  "versions": {
    "asOf": "2026-11-12",
    "complete": true,
    "reason": "Every known release line has already ended.",
    "recommendation": null,
    "notes": [],
    "lines": [
      {
        "id": "*",
        "vers": "vers:npm/*",
        "status": "ended",
        "endDate": "2020-02-11",
        "ruleId": "npm.package.request.deprecated",
        "event": "deprecated"
      }
    ]
  }
}
```

Every rule entry in a component document includes a `url` link to its own dedicated `/rules/<rule-id>.json` file. Component documents also include optional machine-readable `replacements` collected from their rules, detailing `successor`, `alternative`, or `upgrade` targets with Package URLs and version ranges.

### 2. Fetch a Single Rule
Each rule has its own permanent address with full evidence sources and provenance:

:::terminal
$ curl -s https://velella.sh/ebb/api/v1/rules/npm.package.request.deprecated.json | jq .
:::

Rule IDs containing characters not allowed in URLs are percent-encoded (for example, `%2F` for `/`).

### 3. Unknown Components & 404 Handling
Requesting a component or rule that is not present in the Ebb registry returns an HTTP `404 Not Found` response with a JSON error payload:

:::terminal
$ curl -s -i https://velella.sh/ebb/api/v1/npm/unknown-package.json
:::

> [!IMPORTANT]
> A `404` status does **not** mean the component is supported or has no deprecations. It simply means Ebb does not currently have lifecycle data for that package.

### 4. Scoped Packages & GitHub Actions
Scoped packages support both literal `@` and percent-encoded `%40` in paths:

:::terminal
$ curl -s https://velella.sh/ebb/api/v1/npm/@angular/core.json | jq .name
$ curl -s https://velella.sh/ebb/api/v1/github-actions/actions/checkout.json | jq .rules[0].title
$ curl -s https://velella.sh/ebb/api/v1/docker/library/node.json | jq .rules[0].title
:::

### 5. Ecosystem Files
Retrieve all rules registered for a given ecosystem:

:::terminal
$ curl -s https://velella.sh/ebb/api/v1/python.json | jq '{ ecosystem, rulesCount, componentsCount }'
:::

### 6. Upcoming Deadlines
Check upcoming deprecation or EOL deadlines sorted chronologically:

:::terminal
$ curl -s https://velella.sh/ebb/api/v1/upcoming.json | jq '.upcoming[:5]'
:::

### 7. Search Index
Quickly lookup component PURLs by prefix:

:::terminal
$ curl -s https://velella.sh/ebb/api/v1/search-index.json | jq '.prefixes["req"]'
:::

---

## TypeScript / JavaScript Client (`@velella/ebb/api`)

Ebb provides zero-dependency client helpers exported from `@velella/ebb/api` that use standard web `fetch()` with built-in timeouts, automatic retry on network errors, and typed "not found" handling:

```ts
import {
  fetchMeta,
  fetchUpcoming,
  fetchRule,
  fetchComponent,
  fetchSingleRule,
} from "@velella/ebb/api";

// 1. Check data version first
const meta = await fetchMeta();
console.log("Current data version:", meta?.dataVersion);

// 2. Fetch upcoming deprecations and EOL deadlines
const upcoming = await fetchUpcoming();
for (const item of upcoming?.upcoming.slice(0, 3) ?? []) {
  console.log(`${item.purl}: ${item.title} (deadline: ${item.deadline})`);
}

// 3. Fetch rules for a specific version
const rules = await fetchRule("pkg:npm/request@2.88.2");
if (rules && rules.length > 0) {
  console.log("Lifecycle finding:", rules[0].title);
  console.log("Replacement:", rules[0].replacement);
}

// 4. Handle 404 (returns null, does not throw)
const unknown = await fetchComponent("pkg:npm/unknown-package");
if (unknown === null) {
  // Remember: 404 does not mean supported, only that no data is recorded
  console.log("No lifecycle data recorded in Ebb for this package.");
}
```

### Timeout and Retry Options
All client helpers accept a `timeout` option (default: `5000` ms) and automatically retry once on network failure:

```ts
const comp = await fetchComponent("pkg:npm/request", {
  baseUrl: "https://my-internal-mirror.corp/ebb/api/v1",
  timeout: 3000,
});
```

---

## OpenAPI 3.1 Specification

The complete API is formally described in OpenAPI 3.1 at `/openapi.json`:
- `https://velella.sh/ebb/api/v1/openapi.json`

This specification is automatically generated from the endpoint definitions and JSON Schemas on every build.

---

## Published JSON Schemas

All static API files reference and adhere strictly to published JSON Schemas hosted under `/schemas/`:
- `https://velella.sh/ebb/api/v1/schemas/static-api.v1.schema.json`
- `https://velella.sh/ebb/api/v1/schemas/rule.v2.schema.json`
- `https://velella.sh/ebb/api/v1/schemas/registry.v2.schema.json`
- `https://velella.sh/ebb/api/v1/schemas/result.v1.schema.json`

Every generated file points its `$schema` property directly at the published schema.

---

## Caching & Performance

- **Immutable URL Paths**: Versioned endpoints under `/api/v1/` have fixed schemas.
- **Content Hashes & ETags**: Every component entry in `/api/v1/index.json` includes `sha256` and `etag` fields (`"\"<hash>\""`). Clients can perform conditional `If-None-Match` requests or verify file integrity before downloading full rule payloads.
- **Strict Size Budgets**:
  - `index.json`: < 50 KB gzipped (~35 KB actual)
  - `search-index.json`: < 25 KB gzipped (~10 KB actual; automatically split by first letter if exceeded)
  - `all.json`: < 250 KB gzipped (~148 KB actual across all 830+ rules)

---

## Static API v1 Stability Promise

The static API v1 guarantees strict backward compatibility:
1. **v1 only gains fields and endpoints.** Existing endpoints and fields will never be removed, renamed, or change type in v1.
2. Any breaking changes or structural redesigns will only ever appear in a new major version under a new path (for example, `/api/v2/`).
3. Compatibility is locked in CI by automated shape snapshot tests (`tests/static-api-compat.test.ts`).
