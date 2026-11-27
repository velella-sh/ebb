---
layout: default
title: Renovate feed
permalink: /renovate/
---

# Renovate feed

Expose Ebb lifecycle and deprecation data to [Renovate](https://docs.renovatebot.com/) through a static custom datasource and shareable preset.

## Quickstart

Add the Ebb shareable preset to your `renovate.json`:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    "github>velella-sh/ebb//renovate/eol"
  ]
}
```

That two-line addition configures Renovate's custom datasource against Ebb's static API feeds and maps major language runtimes and base container images to their Ebb lifecycle lines.

## What you will see

When your repository depends on an end-of-life runtime version (such as Node.js 18 or Python 3.7):

1. **Deprecation detection**: Renovate evaluates Ebb's feed for the component. Releases that have passed their end-of-life date carry `isDeprecated: true`.
2. **Upgrade branch creation**: Renovate opens or updates an upgrade pull request proposing migration to the next active release line (for example, upgrading from Node.js `18.x` to `22.x`).
3. **Deprecation warning**: If configured or on the Dependency Dashboard, the dependency is flagged as deprecated.
4. **No regressions**: Active, supported release lines are never flagged as deprecated.

### Observed Renovate behaviour

The behaviour below was recorded using Renovate version `42.99.0` running locally on a test fixture:

```bash
npx --package=renovate@42.99.0 renovate --platform=local --dry-run=lookup
```

#### Log extraction

When Renovate processes the custom datasource with a deprecated release:

```text
DEBUG: Overriding datasource from node-version to custom.ebb for node (repository=local)
DEBUG: Overriding datasource from docker to custom.ebb for node (repository=local)
DEBUG: Package releases lookups complete (repository=local)
DEBUG: 1 flattened updates found: node (repository=local)
DEBUG: Branch is not pending, removing pending upgrades (repository=local, branch=renovate/node-22.x)
       "depName": "node",
       "datasource": "node-version",
       "currentValue": "18.0.0",
       "updates": [
         {
           "bucket": "major",
           "newVersion": "22.x",
           "updateType": "major",
           "isBreaking": true,
           "branchName": "renovate/node-22.x"
         }
       ]
```

When all releases are supported or when the feed contains zero releases, Renovate outputs:

```text
DEBUG: 0 flattened updates found:  (repository=local)
```

## How Ebb compares with `endoflife-date` datasource

Renovate includes a built-in `endoflife-date` datasource that queries `endoflife.date`:

* **Configuration**: `endoflife-date` is configured as a native datasource using `registryUrls: ["https://endoflife.date/api/"]`.
* **Cycle mapping**: It parses `cycle` strings and matches them against `version: latest ?? cycle`. It evaluates `eol <= now` using client-side date comparison in its Zod schema.
* **Coverage differences**: `endoflife-date` covers popular products but lacks Ebb's package URL (pURL) standard alignment, confidence scoring, evidence citations, and package ecosystem rules.
* **Ebb's approach**: Ebb exposes clean static JSON feeds at `/renovate/<type>/<name>.json` with precomputed `isDeprecated` booleans evaluated against the build date, eliminating client-side clock drift and providing deterministic, offline-verifiable data.

## Component feeds and coverage

Ebb generates Renovate feeds for all components that define distinct **release lines** (296 components across generic runtimes, Docker images, and package managers).

### Included components

A component receives a feed at `/ebb/api/v1/renovate/<type>/<name>.json` when Ebb rules define half-open release line bounds (`vers:semver/>=20.0.0|<21.0.0` for `20.x`, `vers:pypi/>=3.11|<3.12` for `3.11`, or `*` for universal deprecation):

* **Generic runtimes**: `generic/nodejs`, `generic/python`, `generic/golang`, `generic/ruby`, `generic/dotnet`, `generic/deno`, `generic/bun`, `generic/erlang`, `generic/elixir`, `generic/dart`.
* **Container images**: `docker/library/node`, `docker/library/python`, `docker/library/postgres`, `docker/library/redis`, `docker/library/ruby`, `docker/library/alpine`.
* **Databases & services**: `generic/postgresql`, `generic/mysql`, `generic/redis`, `generic/mongodb`, `generic/kubernetes`.
* **Ecosystem libraries**: Deprecated packages across `npm`, `pypi`, `nuget`, `cargo`, and `golang`.

### Omitted components

Components that have rules in Ebb but do **not** define discrete release lines are omitted:

* **Open-ended version bounds**: Rules that only assert open floor or ceiling bounds (for example, Android target SDK `vers:semver/<35.0.0` or Azure VM images) without bounded release lines.
* **Single individual version rules**: Rules that flag isolated patch versions or security advisories rather than release lines.

No synthetic versions are invented beyond what the authoritative rules and release line bounds specify.

## Static API feed format

Each feed served at `https://velella.sh/ebb/api/v1/renovate/<type>/<name>.json` adheres to Renovate's custom datasource JSON format:

```json
{
  "releases": [
    {
      "version": "18.x",
      "isDeprecated": true
    },
    {
      "version": "20.x",
      "isDeprecated": true
    },
    {
      "version": "22.x",
      "isDeprecated": false
    }
  ],
  "homepage": "https://nodejs.org",
  "sourceUrl": "https://github.com/nodejs/node"
}
```

## Current limits

* **Datasource format**: Feeds use Renovate's existing `customDatasources` mechanism with `format: "json"` and `versioning: "loose"`.
* **Enrichment module**: Renovate architectural issue [#40048](https://github.com/renovatebot/renovate/issues/40048) proposes a new pluggable "package data enrichment" pipeline. That module is currently an RFC and not yet merged into Renovate; the Ebb preset relies strictly on currently available custom datasources.

## Verification

The Renovate preset and custom datasource integration are verified end-to-end in CI on every push and pull request. View the workflow at [.github/workflows/renovate-e2e.yml](https://github.com/velella-sh/ebb/blob/main/.github/workflows/renovate-e2e.yml).
