---
title: Compatibility table v1
description: Versioned framework and build tool compatibility using Package URLs, VERS, and source evidence.
layout: doc
permalink: /formats/compat.v1/
---

A compatibility table supplies version-range evidence for a relationship between components. Ebb publishes each `registry/tables/<name>.compat.json` at `/ebb/api/v1/compat/<name>.json`. Use the [compatibility table schema](https://velella.sh/ebb/api/v1/schemas/compat.v1.schema.json) to validate the JSON shape.

## Table and rows

The document contains `schemaVersion: "ebb.compat.v1"`, a `rows` array, and an optional `$schema` URI. Each row has these fields.

| Field | Meaning |
| --- | --- |
| `subject` | Canonical, versionless Package URL (PURL) of the component. |
| `subjectVers` | The subject versions covered by the evidence, as canonical VERS. |
| `requires` | One or more requirements, each with a canonical versionless `purl` and a `vers` range. |
| `kind` | `documented` for statements in a project's docs or release notes. `declared` for machine-readable package metadata. |
| `source` | The evidence's HTTPS `url`, `title`, and `accessedAt` date as `YYYY-MM-DD`. |
| `note` | Optional qualification, such as a separate deployment constraint or test coverage limit. |

Use the VERS scheme for each PURL type. A generic PURL can choose a supported scheme appropriate to the component. Use a consistent version comparator for each PURL across the tables. Multiple entries for one requirement PURL in a row are jointly required. A runtime query evaluates that PURL's constraints. Call `requirementsOf` to get the other constraints in the same row.

## Query results

- `supported` means a preferred covering row allows the supplied requirement version.
- `not-supported` means one or more preferred rows cover the subject version and mention the requirement, and every one excludes the queried requirement version.
- `unknown` means no applicable row or evidenced release answers the query.

When rows overlap for a subject version and requirement PURL, prefer documented rows. Within one evidence kind, a row allowing the given version is enough for `supported`. Return a covering row and its evidence for either determinate answer. A requirements listing preserves rows from both kinds.

For a first-supporting query, use exact subject versions and inclusive lower bounds as candidates. Evaluate each candidate with the same overlap rules. Return the lowest documented candidate that qualifies, or the lowest declared candidate when no documented candidate qualifies. An open lower bound alone offers no candidate.

## Examples

A Django compatibility row with a patch boundary from the project's installation FAQ.

```json
{
  "subject": "pkg:pypi/django",
  "subjectVers": "vers:pypi/>=5.1.3|<5.2",
  "requires": [
    { "purl": "pkg:generic/python", "vers": "vers:pypi/>=3.10|<3.14" }
  ],
  "kind": "documented",
  "source": {
    "url": "https://docs.djangoproject.com/en/6.1/faq/install/#what-python-version-can-i-use-with-django",
    "title": "Django Python installation FAQ",
    "accessedAt": "2026-11-28"
  }
}
```

An npm declaration applies only to the listed releases.

```json
{
  "subject": "pkg:npm/%40npmcli/move-file",
  "subjectVers": "vers:npm/1.0.1|1.1.0|1.1.1|1.1.2",
  "requires": [
    { "purl": "pkg:generic/nodejs", "vers": "vers:semver/>=10.0.0" }
  ],
  "kind": "declared",
  "source": {
    "url": "https://registry.npmjs.org/%40npmcli%2Fmove-file",
    "title": "@npmcli/move-file npm engines.node metadata",
    "accessedAt": "2026-11-28"
  }
}
```

Build tools can reuse the format. For example, the Android Gradle Plugin compatibility table documents Gradle 8.7 as the minimum for AGP 8.5.

```json
{
  "subject": "pkg:maven/com.android.tools.build/gradle",
  "subjectVers": "vers:maven/>=8.5.0|<8.6.0",
  "requires": [
    { "purl": "pkg:generic/gradle", "vers": "vers:semver/>=8.7.0" }
  ],
  "kind": "documented",
  "source": {
    "url": "https://developer.android.com/build/releases/agp-8-5-0-release-notes#compatibility",
    "title": "Android Gradle Plugin 8.5 compatibility",
    "accessedAt": "2026-11-28"
  }
}
```
