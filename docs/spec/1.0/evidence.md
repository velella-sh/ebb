---
title: Evidence and provenance
description: Authoritative sources, review metadata, and confidence for lifecycle claims.
layout: doc
permalink: /spec/1.0/evidence/
---

### ELF-EVIDENCE-01

A rule MUST list at least one authoritative evidence source. Every item MUST supply a non-empty `title`, HTTPS `url` and `accessedAt` calendar day. An `archiveUrl` can identify a preserved HTTPS copy and `archivedAt` can give the day of capture. A `pointer`, when provided, MUST be a non-empty [RFC 6901 JSON Pointer](https://www.rfc-editor.org/rfc/rfc6901.html) beginning with `/`, identifying the evidence within a structured source.

For example, this source on `nodejs.runtime.eol-20` cites the Node.js release schedule and the exact value carrying the date.

```json
{
  "title": "Node.js Release Working Group schedule",
  "url": "https://raw.githubusercontent.com/nodejs/Release/main/schedule.json",
  "accessedAt": "2026-11-26",
  "archiveUrl": "https://web.archive.org/web/20261017000000/https://github.com/nodejs/Release/blob/main/schedule.json",
  "archivedAt": "2026-10-17",
  "pointer": "/v20/end"
}
```

### ELF-EVIDENCE-02

A producer MUST record `observedAt`, `reviewedAt`, `reviewer` and `method`. The observation day states when the evidence was recorded. The review day MUST be on or after the observation day. The reviewer identifies the maintainer responsible for the review. If provided, `reviewers` MUST contain at least one non-empty reviewer name and lists the reviewers. A single reviewer can satisfy the review requirement.

| Method | Meaning |
| --- | --- |
| `manual` | The rule was curated manually from the cited evidence. |
| `imported` | A tool translated an external source into the rule format. |
| `upstream` | The component's own maintainers published the source lifecycle data. |

`importer` and `importerVersion` are optional non-empty strings that identify the translator and its version. The complete [rule example](rule.md#complete-rule) shows one maintainer reviewing a manually curated record.

### ELF-EVIDENCE-03

A consumer SHOULD show the evidence next to the applicable verdict. Identify the source by title, give its URL and access day, and show the review date where available. Use the archived address as a separate preserved reference when supplied. Automated source reachability and rule review record different checks.

### ELF-EVIDENCE-04

If present, `confidence` MUST be `confirmed`, `likely` or `tentative`. `confirmed` identifies a claim backed directly by a primary source, `likely` a claim supported by an import or an established schedule, and `tentative` a claim with partial or inferred evidence. A tentative claim MUST have a non-empty `confidenceNote` explaining the gap. Consumers SHOULD show that note alongside the result and keep any derived confidence separate from the value stated by the rule.
