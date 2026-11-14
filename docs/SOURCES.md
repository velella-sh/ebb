---
title: "Source Health and Link Checking"
description: "How Ebb monitors authoritative evidence links and detects broken sources."
layout: doc
permalink: /sources/
---

# Source Health and Link Checking

Every lifecycle rule in Ebb cites authoritative sources (vendor release notices, support policies, deprecation schedules). To prevent link rot and silent upstream alterations, Ebb continually validates the health and accuracy of all cited evidence.

## Health Statuses

Each evidence URL tracked in `registry/sources.lock.json` has a health status:

| Status | Meaning |
|---|---|
| `ok` | The page is reachable (HTTP 200), unchanged, and confirms the rule claims. |
| `changed` | The page was retitled, permanently redirected to another page, or no longer mentions the targeted version. |
| `unreachable` | The server returned an HTTP error (404, 500) or connection timed out. |
| `blocked` | The source returned a bot challenge (Cloudflare, Oracle challenge, 403), unverified by automated crawlers. |
| `unrecorded` | A new source cited in a rule but not yet locked in `registry/sources.lock.json`. |

## Automated Weekly Checks

The weekly GitHub Actions workflow ([`.github/workflows/sources.yml`](https://github.com/velella-sh/ebb/blob/main/.github/workflows/sources.yml)) audits every source URL:

1. **Backoff and Rate Limiting:**
   Requests respect `Retry-After` HTTP headers and retry transient failures (HTTP 429, 503) using exponential backoff.
2. **Redirect & Relocation Tracking:**
   Detects when a source URL permanently redirects to a different document or domain.
3. **Version Mention Verification:**
   Verifies that the content of the target page still references the version numbers or components covered by the rule.
4. **Dead Source Issue Tracking:**
   When a source URL becomes dead (e.g. HTTP 404), the workflow opens an issue labeled `good first issue`, `help wanted`, and `area: data` with deduplication markers (`<!-- ebb-dead-source: <hash> -->`) so new contributors can locate updated links or Wayback Machine archive snapshots.

## Running Locally

To check source health locally:

:::terminal
$ npm run build
$ node dist/tools/check-sources.js
:::

To update `registry/sources.lock.json` after reviewing reported changes:

:::terminal
$ node dist/tools/check-sources.js --update-lock
:::
