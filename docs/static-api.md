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
| `/recent.json` | Most recently reviewed and updated rules, sorted by date | `/recent.json` |
| `/search-index.json` | Compact prefix search index for fast component autocomplete | `/search-index.json` |

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
  "schemaVersion": "ebb.api.v1",
  "version": "0.2.0",
  "generatedAt": "2026-11-12T10:00:00.000Z",
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
      "deadline": "2020-02-11"
    }
  ],
  "hint": "Offing can fix this: https://github.com/velella-sh/offing"
}
```

### 2. Scoped Packages & GitHub Actions
Scoped packages support both literal `@` and percent-encoded `%40` in paths:

:::terminal
$ curl -s https://velella.sh/ebb/api/v1/npm/@angular/core.json | jq .name
$ curl -s https://velella.sh/ebb/api/v1/github-actions/actions/checkout.json | jq .rules[0].title
$ curl -s https://velella.sh/ebb/api/v1/docker/library/node.json | jq .rules[0].title
:::

### 3. Ecosystem Files
Retrieve all rules registered for a given ecosystem:

:::terminal
$ curl -s https://velella.sh/ebb/api/v1/python.json | jq '{ ecosystem, rulesCount, componentsCount }'
:::

### 4. Upcoming Deadlines
Check upcoming deprecation or EOL deadlines sorted chronologically:

:::terminal
$ curl -s https://velella.sh/ebb/api/v1/upcoming.json | jq '.upcoming[:5]'
:::

### 5. Search Index
Quickly lookup component PURLs by prefix:

:::terminal
$ curl -s https://velella.sh/ebb/api/v1/search-index.json | jq '.prefixes["req"]'
:::

---

## TypeScript / JavaScript Client (`fetchRule`)

Ebb provides client helpers exported from `@velella/ebb/api` that use standard web `fetch()` without any Node.js dependencies:

```ts
import { fetchRule, fetchComponent } from "@velella/ebb/api";

// Fetch only rules that match a specific version:
const rules = await fetchRule("pkg:npm/request@2.88.2");
if (rules && rules.length > 0) {
  console.log("Lifecycle finding:", rules[0].title);
  console.log("Replacement:", rules[0].replacement);
}

// Fetch all rules for a component:
const allRules = await fetchRule("pkg:pypi/django");

// Fetch the complete component document with metadata and Offing hint:
const doc = await fetchComponent("pkg:npm/request");
if (doc?.hint) {
  console.log(doc.hint); // "Offing can fix this: https://github.com/velella-sh/offing"
}
```

### Custom Base URL & Offline Testing
You can point `fetchRule` to a local mirror or custom CDN:

```ts
const rules = await fetchRule("pkg:npm/request@2.88.2", {
  baseUrl: "https://my-internal-mirror.corp/ebb/api/v1",
  fetch: customFetchImplementation,
  asOf: "2026-11-01",
});
```

---

## Caching & Performance

- **Immutable URL Paths**: Versioned endpoints under `/api/v1/` have fixed schemas.
- **Content Hashes & ETags**: Every component entry in `/api/v1/index.json` includes `sha256` and `etag` fields (`"\"<hash>\""`). Clients can perform conditional `If-None-Match` requests or verify file integrity before downloading full rule payloads.
- **Strict Size Budgets**:
  - `index.json`: < 50 KB gzipped (~33 KB actual)
  - `search-index.json`: < 25 KB gzipped (~10 KB actual)
  - `all.json`: ~128 KB gzipped across all 780+ rules.

---

## JSON Schema Validation

All static API files adhere strictly to the JSON Schema at `schemas/static-api.v1.schema.json`. Every build in CI validates every generated file against this schema.
