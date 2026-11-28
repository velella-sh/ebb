---
title: The rule object
description: Fields, examples and validation of a lifecycle rule.
layout: doc
permalink: /spec/1.0/rule/
---

The [rule v2 JSON Schema](https://github.com/velella-sh/ebb/blob/main/schemas/rule.v2.schema.json) defines the standalone rule shape. The [registry v2 schema](https://github.com/velella-sh/ebb/blob/main/schemas/registry.v2.schema.json) carries rules in a registry. These wire versions are independent of the draft's specification version.

### ELF-RULE-01

A producer MUST supply every field marked required. Each field MUST have the type and meaning below. Examples in the table are individual field values, while the complete rule demonstrates how they fit together.

| Field | Type and presence | Meaning | Example |
| --- | --- | --- | --- |
| `id` | Required string | Stable lowercase rule identifier with dot or hyphen separators. | `npm.package.left-pad.deprecated` |
| `ecosystem` | Required slug string | Registry ecosystem. A registry entry uses the ecosystem of its containing registry. | `npm` |
| `purl` | Required string | Canonical, versionless Package URL of the component. | `pkg:npm/left-pad` |
| `vers` | Required string | Affected VERS range, in a scheme consistent with the PURL. | `vers:npm/*` |
| `event` | Required string enum | One [lifecycle event](https://velella.sh/ebb/spec/1.0/events/#elf-event-01). | `deprecated` |
| `title` | Required non-empty string | Short label for the event. | `left-pad is deprecated` |
| `summary` | Required non-empty string | Evidence-backed description of the affected lifecycle behavior. | `The package author recommends the built-in String.prototype.padStart method.` |
| `severity` | Required string enum | Report priority, one of `info`, `low`, `medium`, `high` and `critical`. | `medium` |
| `replacement` | Optional non-empty string | Human-readable migration recommendation. | `String.prototype.padStart()` |
| `replacements` | Optional array of objects | Machine-readable replacement targets. | `[{"purl":"pkg:npm/sass","name":"sass","kind":"successor"}]` from `npm.package.node-sass.eol` |
| `requires` | Optional non-empty object | Minimum runtime versions for the proposed replacement. Keys are `node` and `python`, with up to three numeric version parts. | `{"node":"18.0.0"}` from `npm.package.request-promise.deprecated` |
| `deadline` | Calendar date string, required for scheduled end of life and end of active support | Effective date of the [described event](https://velella.sh/ebb/spec/1.0/events/#elf-event-01). | `2027-04-30` from `nodejs.runtime.eol-22` |
| `confidence` | Optional string enum | Strength of the evidence claim, described in [evidence](https://velella.sh/ebb/spec/1.0/evidence/#elf-evidence-04). | `likely` |
| `confidenceNote` | Non-empty string when present, required for tentative claims | Explanation of the confidence level. | `The vendor confirms the line ended but provides no exact day.` |
| `sources` | Required non-empty array | Evidence supporting the claim. | The source in the complete rule below |
| `provenance` | Required object | Dates, reviewer and method for the rule. | The provenance object in the complete rule below |
| `migration` | Optional object | Structured constraints, steps and verification guidance for the affected code or declaration. | The migration example below |
| `usage` | Optional array | Usage-level matchers for an import, call, symbol or configuration key. | `[{"kind":"import","language":"javascript","module":"request"}]` |
| `url` | Optional string, informative | Canonical URL of the rule in a publishing surface. | `https://velella.sh/ebb/api/v1/rules/npm.package.left-pad.deprecated.json` |
| `sourceCheckedAt` | Optional UTC calendar date string, informative | When automated source verification ran. | `2026-11-23` |
| `sourceStatus` | Optional string enum, informative | Result of automated source verification. | `ok` |

`sourceStatus` values are `ok`, `stale`, `changed`, `unreachable`, `blocked`, `unrecorded`, `date-missing`, `date-changed` and `archived-only`.

### ELF-RULE-02

The producer MUST preserve a rule's `id` when correcting its evidence, dates or affected range. A rule's `purl` and `vers` MUST describe the component and range together. An event's severity and date MUST satisfy [event constraints](https://velella.sh/ebb/spec/1.0/events/#elf-event-02).

### ELF-RULE-03

Each structured replacement MUST have a versionless `purl`, non-empty `name` and `kind` of `successor`, `alternative` or `upgrade`. An optional `vers` limits the suggested target versions. An optional `note` explains migration context. A `successor` is a replacement relation, with the same v2 shape as the Sass example above.

### ELF-RULE-04

A supplied migration object MUST have non-empty arrays for `constraints`, `steps` and `verification`. A step has `id`, `title`, `instructions` and a `targets` value of `declaration`, `usages` or `all`. Each verification entry has `command` and `purpose` text. This is guidance for a user or integrator.

The matched usage kinds and language sets are specified in the rule schema. An import uses `language` and `module`. A call also names non-empty `targets`. A symbol names its `language`, `symbol` and `shape`, with `module` when applicable. An option shape adds `option` and can supply a zero-based `argument`. A configuration matcher names `language` and `key`, with optional `valueIncludes`.

### ELF-RULE-05

A producer MAY use an object-valued `x-<slug>` field for additional ecosystem data. The value MUST agree with the core fields. A core consumer MUST ignore extension fields it does not recognize. For example, `"x-npm": {"package":"left-pad"}` repeats the package-name hint without changing its identity. The registry schema separately defines the recognized `x-ical.sequence` calendar revision.

## Complete rule

This valid rule example uses the registry’s `npm.package.left-pad.deprecated` record with selected optional fields.

```json
{
  "id": "npm.package.left-pad.deprecated",
  "ecosystem": "npm",
  "purl": "pkg:npm/left-pad",
  "vers": "vers:npm/*",
  "event": "deprecated",
  "title": "left-pad is deprecated",
  "summary": "The package author recommends the built-in String.prototype.padStart method.",
  "severity": "medium",
  "replacement": "String.prototype.padStart()",
  "sources": [
    {
      "title": "left-pad package deprecation notice",
      "url": "https://www.npmjs.com/package/left-pad",
      "accessedAt": "2026-10-13",
      "archiveUrl": "https://web.archive.org/web/20261013000000/https://www.npmjs.com/package/left-pad",
      "archivedAt": "2026-10-13"
    }
  ],
  "provenance": {
    "observedAt": "2026-10-13",
    "reviewedAt": "2026-10-14",
    "reviewer": "arminazimi",
    "reviewers": ["arminazimi"],
    "method": "manual"
  },
  "x-npm": {"package":"left-pad"}
}
```

This migration object shows the first step and verification entry on `npm.package.request.deprecated`.

```json
{
  "constraints": [
    "Preserve request method, headers, authentication, redirects, timeouts, retries, proxy behavior, streaming, and response/error semantics used by each call site."
  ],
  "steps": [
    {
      "id": "choose-http-client",
      "title": "Choose the target HTTP client",
      "instructions": "Select native fetch or one maintained client whose behavior covers the affected request usages.",
      "targets": "all"
    }
  ],
  "verification": [
    {
      "command": "npm run test --if-present",
      "purpose": "Run HTTP behavior and repository tests when defined."
    }
  ]
}
```

## Current validation and pending work

Every rule in the checked repository snapshot validates against the standalone schema. The runtime additionally validates actual calendar dates, canonical PURL and VERS semantics, review ordering, scheduled severity and conditional fields. JSON Schema validation alone establishes shape. This chapter describes the current contract. The [successor coverage epic](https://github.com/velella-sh/ebb/issues/657) and [draft prediction profile](https://velella.sh/ebb/spec/1.0/predictions/) track the open scope of the [rule chapter issue](https://github.com/velella-sh/ebb/issues/877).
