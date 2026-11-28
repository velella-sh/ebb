---
title: Site Data Files (v1)
description: Deterministic component, release line, and rule records for documentation and site builders.
layout: doc
permalink: /site-data/
---

# Ebb Site Data Files (v1)

Ebb produces pre-generated, deterministic data files designed for site builders and documentation generators. Any site builder can generate complete pages for every component, every release line, and every rule from these data files alone.

Unlike the Static API (`/api/v1/`), which is designed for programs and lookup tooling, Site Data records include page-building essentials:
- URL-safe stable slugs
- Concise, plain-text titles (< 70 characters) and one-sentence summaries (< 160 characters)
- Explicit relational links between records by slug
- Collections for ecosystems, upcoming events, recent release changes, and redirects

> [!NOTE]
> Site Data files contain pure data only. They contain no HTML, CSS styling, colour information, or layout instructions. Site generation belongs to site tools, not Ebb.

---

## Published page JSON

Append `index.json` to the published record URL. Product, release-line and rule pages expose the same record data as their rendered pages.

- [Product JSON for Node.js](https://velella.sh/ebb/products/nodejs-nodejs/index.json)
- [Release-line JSON for Node.js 20.x](https://velella.sh/ebb/release-lines/nodejs-nodejs-line-20-x/index.json)
- [Rule JSON for Node.js 20.x end of life](https://velella.sh/ebb/rules/nodejs-runtime-eol-20/index.json)

Read `record.id` for the stable identity, `record.fields.dataVersion` for the signed data version, and `record.fields` for lifecycle fields such as status, dates, and precision. `record.evidence` carries the source links by field. The top-level `url` is the published page path.

## Canonical record URLs

Product, release-line and rule pages use `/ebb/products/{slug}/`, `/ebb/release-lines/{slug}/`, and `/ebb/rules/{slug}/` respectively. `tools/site-data/slugs.lock.json` assigns slugs to stable record IDs. If a slug changes, add its previous slug to the lock's `redirects` map. The site sends each known previous slug directly to the current canonical page. A rule ID can also be used at `/ebb/rules/{id}/` to reach its canonical slug. The [versioned rule JSON](static-api.md) remains at `/ebb/api/v1/rules/{id}.json`.

Use **Report a problem with this data** on a record page to open a correction with the record ID, page and signed data version filled in. The rule page links to its authoritative sources under **Evidence**.

When updating the pinned signed site release, run the signed site-data command with `--rule-routes-out src/public-rule-routes.ts` to refresh the offline CLI and MCP link catalogue. The signed site test compares the catalogue with every published rule route.

## Stability Contract

Site Data v1 adheres to a strict backward compatibility promise:
1. **Additive Evolution**: v1 only gains fields and files. Existing field names and files are never removed or renamed.
2. **Stable Slugs**: Slugs are permanent and recorded in `tools/site-data/slugs.lock.json`. If a record's slug changes, it must have an explicit redirect entry in `slugs.lock.json`, which is published to `redirects.json`.
3. **Deterministic Output**: Output generated from the same registry dataset is 100% byte-for-byte identical. All dates are taken strictly from the dataset, never from the system clock.
4. **Guaranteed Links**: Every link between records references an existing record in the dataset.

---

## Directory Layout

Running `npm run site-data` writes all files to `dist/site-data/`:

| File or Directory | Description | Relied Upon |
| :--- | :--- | :--- |
| `components.json` | Collection of all component records with data version | Yes |
| `components/<slug>.json` | Individual component record for direct page generation | Yes |
| `rules.json` | Collection of all rule records with data version | Yes |
| `rules/<slug>.json` | Individual rule record | Yes |
| `lines.json` | Collection of all release line records with data version | Yes |
| `lines/<slug>.json` | Individual release line record | Yes |
| `ecosystems.json` | Catalog of ecosystems with component counts and record IDs | Yes |
| `upcoming.json` | Scheduled deprecations and end-of-life dates grouped by month | Yes |
| `releases.json` | Rule additions, modifications, and removals across data releases | Yes |
| `redirects.json` | Mapping of renamed historical slugs to their current slug | Yes |
| `index.json` | Summary manifest with record counts, data version, and file listing | Yes |

---

## Record Types & Field Contracts

### 1. Component Record

A component record represents an individual software package, runtime, or container image tracked by Ebb.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | Canonical Package URL identity (e.g. `pkg:npm/request`). |
| `recordType` | `"component"` | Yes | Fixed discriminator for component records. |
| `slug` | string | Yes | URL-safe stable identifier (e.g. `npm-request`). |
| `name` | string | Yes | Component name without ecosystem prefix or namespace. |
| `ecosystem` | string | Yes | Target ecosystem (e.g. `npm`, `pypi`, `generic`). |
| `purl` | string | Yes | Canonical Package URL string. |
| `title` | string | Yes | Plain-text page title (< 70 characters). |
| `summary` | string | Yes | Plain-text one-sentence summary (< 160 characters). |
| `status` | string | Yes | Current lifecycle status (`deprecated`, `end-of-life`, `active`, `scheduled`). |
| `dates` | object | Yes | Key dates: `earliestDeadline`, `latestReview`, `observedAt`. |
| `nextEvent` | object or `null` | Yes | Earliest future lifecycle event (`event`, `date`), or `null` if none. |
| `rules` | string[] | Yes | Sorted array of rule IDs associated with this component. |
| `links` | object | Yes | Relational links: `rules` (slugs), `lines` (slugs), `apiUrl`, `sourcePath`. |

#### Component Example

```json
{
  "id": "pkg:npm/request",
  "recordType": "component",
  "slug": "npm-request",
  "name": "request",
  "ecosystem": "npm",
  "purl": "pkg:npm/request",
  "title": "request (npm) lifecycle",
  "summary": "request in npm has lifecycle status deprecated with 1 tracked rule(s).",
  "status": "deprecated",
  "dates": {
    "latestReview": "2026-11-14",
    "observedAt": "2020-02-11"
  },
  "nextEvent": null,
  "rules": [
    "npm.package.request.deprecated"
  ],
  "links": {
    "rules": [
      "npm-package-request-deprecated"
    ],
    "lines": [],
    "apiUrl": "https://velella.sh/ebb/api/v1/npm/request.json",
    "sourcePath": "registry/npm.json"
  }
}
```

---

### 2. Rule Record

A rule record represents a specific lifecycle notice, deprecation schedule, or end-of-life event.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | Registry rule ID (e.g. `npm.package.request.deprecated`). |
| `recordType` | `"rule"` | Yes | Fixed discriminator for rule records. |
| `slug` | string | Yes | URL-safe stable slug derived from the rule ID. |
| `title` | string | Yes | Plain-text rule title (< 70 characters). |
| `summary` | string | Yes | Plain-text one-sentence summary (< 160 characters). |
| `status` | string | Yes | Rule lifecycle event short name. |
| `event` | string | Yes | Lifecycle event (`deprecated`, `end-of-life`, `scheduled-end-of-life`, etc.). |
| `date` | string or `null` | No | Effective or announced deadline date (`YYYY-MM-DD`). |
| `dates` | object | Yes | Date metadata: `deadline`, `announced`, `observedAt`, `reviewedAt`. |
| `affectedRange` | string | Yes | VERS range string describing affected versions. |
| `replacement` | string | No | Text description or PURL of recommended replacement. |
| `migration` | string | No | Markdown migration instructions (constraints, steps, verification). |
| `severity` | string | No | Finding severity (`info`, `low`, `medium`, `high`, `critical`). |
| `confidence` | string | No | Confidence assessment (`confirmed`, `likely`, `tentative`). |
| `sources` | object[] | Yes | Array of evidence citations (`url`, `title`, archive links). |
| `reviewDate` | string | Yes | Most recent review or observation date (`YYYY-MM-DD`). |
| `links` | object | Yes | Relational links: `component` (slug), `replacementComponent` (slug if known), `apiUrl`, `sourcePath`. |

#### Rule Example

```json
{
  "id": "npm.package.request.deprecated",
  "recordType": "rule",
  "slug": "npm-package-request-deprecated",
  "title": "npm.package.request.deprecated: deprecated",
  "summary": "Rule npm.package.request.deprecated marks pkg:npm/request (*) as deprecated with replacement axios.",
  "status": "deprecated",
  "event": "deprecated",
  "dates": {
    "observedAt": "2020-02-11",
    "reviewedAt": "2026-11-14"
  },
  "affectedRange": "*",
  "replacement": "axios",
  "migration": "### Constraints\n- Preserve request options and response handling.\n\n### Steps\n1. **Replace dependency**: Remove request and install axios.\n\n### Verification\n- `npm test`: Verify test suite passes.",
  "severity": "high",
  "confidence": "confirmed",
  "sources": [
    {
      "title": "Request deprecation note on npm",
      "url": "https://www.npmjs.com/package/request"
    }
  ],
  "reviewDate": "2026-11-14",
  "links": {
    "component": "npm-request",
    "apiUrl": "https://velella.sh/ebb/api/v1/rules/npm.package.request.deprecated.json",
    "sourcePath": "registry/npm.json"
  }
}
```

---

### 3. Release Line Record

A release line record represents a major or minor version stream (such as Node.js 20 or Python 3.12) derived through Ebb's version evaluation.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | Composite identifier (`<purl>#<lineId>`). |
| `recordType` | `"release-line"` | Yes | Fixed discriminator for release line records. |
| `slug` | string | Yes | URL-safe slug (e.g. `generic-nodejs-line-20`). |
| `title` | string | Yes | Plain-text release line title (< 70 characters). |
| `summary` | string | Yes | Plain-text one-sentence summary (< 160 characters). |
| `status` | string | Yes | Release line status: `ended`, `ending`, or `no-known-end`. |
| `endDate` | string or `null` | Yes | End-of-life date (`YYYY-MM-DD`) or `null`. |
| `dates` | object | Yes | End date metadata: `endDate`. |
| `line` | string | Yes | Release line label (e.g. `20`, `22`, `3.12`, `*`). |
| `vers` | string | Yes | VERS range covering this release line. |
| `ruleId` | string | Yes | Rule ID that defined this release line. |
| `incomplete` | boolean | No | True when version evaluation reports incomplete line coverage. |
| `links` | object | Yes | Relational links: `component` (slug), `rule` (slug), `apiUrl`, `sourcePath`. |

#### Release Line Example

```json
{
  "id": "pkg:generic/nodejs#20.x",
  "recordType": "release-line",
  "slug": "nodejs-nodejs-line-20-x",
  "title": "nodejs 20.x release line",
  "summary": "Release line 20.x for nodejs has status ended with end date 2026-04-30.",
  "status": "ended",
  "endDate": "2026-04-30",
  "dates": {
    "endDate": "2026-04-30"
  },
  "line": "20.x",
  "vers": "vers:semver/>=20.0.0|<21.0.0",
  "ruleId": "nodejs.runtime.eol-20",
  "links": {
    "component": "nodejs-nodejs",
    "rule": "nodejs-runtime-eol-20",
    "apiUrl": "https://velella.sh/ebb/api/v1/generic/nodejs.json",
    "sourcePath": "registry/nodejs.json"
  }
}
```

---

## Collections & Indexes

### `ecosystems.json`
Contains all active ecosystems, their component counts, and references to component IDs:
```json
{
  "dataVersion": "2026.11.15",
  "ecosystems": [
    {
      "name": "npm",
      "componentCount": 182,
      "recordIds": ["pkg:npm/request", "pkg:npm/left-pad"]
    }
  ]
}
```

### `upcoming.json`
Contains upcoming lifecycle deadlines grouped by month (`YYYY-MM`), derived strictly using the data version date:
```json
{
  "dataVersion": "2026.11.15",
  "months": [
    {
      "month": "2026-12",
      "events": [
        {
          "date": "2026-12-31",
          "event": "end-of-life",
          "ruleId": "python.runtime.eol-3.8",
          "componentId": "pkg:generic/python"
        }
      ]
    }
  ]
}
```

### `releases.json`
Lists rule changes across signed data releases, referencing rule IDs:
```json
{
  "dataVersion": "2026.11.15",
  "releases": [
    {
      "version": "0.4.0",
      "date": "2026-11-14",
      "added": ["npm.package.left-pad.deprecated"],
      "changed": ["npm.package.request.deprecated"],
      "removed": []
    }
  ]
}
```

### `redirects.json`
Key-value mapping of previously published slugs that were renamed, preserving URL permanence for site generators:
```json
{
  "npm-old-name": "npm-new-name"
}
```
