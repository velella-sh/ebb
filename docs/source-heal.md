---
title: "Repairing broken evidence links"
description: "How Ebb identifies, verifies, and repairs unreachable evidence sources with automated pull requests."
layout: doc
permalink: /source-heal/
---

Ebb relies on authoritative evidence sources to justify every lifecycle rule. When upstream documentation moves, gets reorganized, or experiences transient outages, the automated source checker (`tools/check-sources.ts`) and the healing pipeline (`tools/source-heal/`) work together to detect issues, verify candidates, and prepare focused pull requests for human review.

## Problem Analysis

An analysis of historical dead-source alerts (such as failures `#634` through `#642`) revealed four distinct failure modes:

| Source URL | Initial Error | Current Response | Root Cause Category | Action Taken |
|---|---|---|---|---|
| `https://github.com/actions/delete-package-versions/blob/v2/action.yml` | HTTP 503 | HTTP 200 via API | Transient / Rate Limit | Handled via GitHub API contents fetch |
| `https://github.com/actions/delete-package-versions/blob/v5/action.yml` | HTTP 503 | HTTP 200 via API | Transient / Rate Limit | Handled via GitHub API contents fetch |
| `https://github.com/actions/dependency-review-action/blob/v3/action.yml` | HTTP 503 | HTTP 200 via API | Transient / Rate Limit | Handled via GitHub API contents fetch |
| `https://github.com/actions/dependency-review-action/blob/v4/action.yml` | HTTP 503 | HTTP 200 via API | Transient / Rate Limit | Handled via GitHub API contents fetch |
| `https://github.com/actions/download-artifact/blob/v6/action.yml` | HTTP 503 | HTTP 200 via API | Transient / Rate Limit | Handled via GitHub API contents fetch |
| `https://github.com/actions/download-artifact/blob/v7.0.0/action.yml` | HTTP 503 | HTTP 200 via API | Transient / Rate Limit | Handled via GitHub API contents fetch |
| `https://github.com/actions/download-artifact/blob/v7/action.yml` | HTTP 503 | HTTP 200 via API | Transient / Rate Limit | Handled via GitHub API contents fetch |
| `https://github.com/actions/go-dependency-submission/blob/main/action.yml` | HTTP 503 | HTTP 200 via API | Transient / Rate Limit | Handled via GitHub API contents fetch |
| `https://example.com/moved-page` | HTTP 404 | HTTP 301 / New URL | Moved / Relocated | Redirect followed; new URL candidate checked |
| `https://example.com/dead-page` | HTTP 404 | HTTP 404 | Gone | Wayback Machine snapshot queried & verified |

### Failure Categories

1. **Transient Server Errors & Rate Limits**: Automated scraping of HTML pages on hosts like GitHub frequently triggers transient 503/429 responses or bot challenge protections. Using dedicated APIs (e.g. GitHub Contents API) with repository tokens resolves these false alarms.
2. **Single Transient Outage vs. Persistent Failure**: An issue should never be opened on a single failure. Sources must fail twice at least 24 hours apart before an alert issue is filed.
3. **Moved Pages & Renamed Repositories**: Upstream vendors reorganize documentation or rename repositories. Following HTTP redirects, checking GitHub repository transfer redirects, and inspecting parent directories locate the relocated evidence.
4. **Discontinued & Vanished Pages**: When a vendor permanently deletes a document, the Wayback Machine availability API is queried to locate a verified archive copy captured before the failure date.

## Healing Bot Decision Rules

The healer processes dead sources according to strict automated rules:
1. **Never change lifecycle claims**: A heal pull request NEVER alters dates, events, severity, or VERS ranges.
2. **Verify lifecycle date presence**: A candidate URL or archive snapshot is only accepted if it explicitly contains the rule's documented lifecycle date or matches the structured JSON pointer.
3. **Prefer live relocated URLs over archives**: If a valid redirect or repository relocation exists and passes verification, update `sources[].url`. If only an archive snapshot is available, keep the original `url` and set `archiveUrl` and `archivedAt`.
4. **Human review required**: When no candidate satisfies the verification criteria, the issue remains open with full provenance records for maintainer review.

## Reviewing a Heal Pull Request

Maintainers and contributors can review automated heal pull requests with the following checklist:
- Confirm that the diff only changes `sources[].url` or adds `archiveUrl` / `archivedAt`.
- Check that `npm run check` and `npm run lint:rules` pass.
- Verify that the linked source clearly confirms the deprecation or end-of-life statement for the affected package versions.

## Example Heal Reports

### Example: Relocated Source
```json
{
  "schemaVersion": "ebb.source-heal.v1",
  "healedAt": "2026-11-27T12:00:00Z",
  "oldUrl": "https://github.com/old-org/repo/blob/main/README.md",
  "failures": [
    { "timestamp": "2026-11-25T05:00:00Z", "error": "HTTP 404" },
    { "timestamp": "2026-11-26T06:00:00Z", "error": "HTTP 404" }
  ],
  "candidate": {
    "type": "relocated",
    "url": "https://github.com/new-org/repo/blob/main/README.md",
    "method": "github-redirect",
    "dateFound": true
  },
  "decision": "relocate"
}
```

### Example: Archived Copy Found
```json
{
  "schemaVersion": "ebb.source-heal.v1",
  "healedAt": "2026-11-27T12:00:00Z",
  "oldUrl": "https://docs.vendor.com/legacy/eol.html",
  "failures": [
    { "timestamp": "2026-11-25T05:00:00Z", "error": "HTTP 404" },
    { "timestamp": "2026-11-26T06:00:00Z", "error": "HTTP 404" }
  ],
  "candidate": {
    "type": "archive",
    "url": "https://web.archive.org/web/20250601000000/https://docs.vendor.com/legacy/eol.html",
    "method": "wayback-availability",
    "dateFound": true
  },
  "decision": "archive"
}
```

### Example: Rejected Candidate / Unhealed
```json
{
  "schemaVersion": "ebb.source-heal.v1",
  "healedAt": "2026-11-27T12:00:00Z",
  "oldUrl": "https://docs.vendor.com/removed-notice.html",
  "failures": [
    { "timestamp": "2026-11-25T05:00:00Z", "error": "HTTP 404" },
    { "timestamp": "2026-11-26T06:00:00Z", "error": "HTTP 404" }
  ],
  "candidate": null,
  "decision": "unresolved"
}
```
