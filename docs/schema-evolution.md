---
title: Schema evolution
description: Inspect JSON Schema changes against the last tagged Ebb package release.
layout: doc
permalink: /schema-evolution/
---

The schema evolution report compares the working tree with the newest reachable stable package tag. It applies the [draft Lifecycle Format versioning policy](https://velella.sh/ebb/spec/1.0/versioning/) to Ebb's current published package schemas. The formal freeze and deprecation gate depend on a published specification version and the approved deprecation register.

## Run the comparison

Run both commands from a full checkout with the release tags.

```bash
npm ci
npm run schema:evolution
```

The command prints the selected tag, its commit hash, and each changed file and JSON pointer. Exit status `0` means no breaking or unknown findings, `1` means at least one finding needs review, and `2` means the comparison could not run. For a shallow clone, fetch full history and the release tags with `git fetch --unshallow --tags`.

The baseline is read from immutable Git objects at the resolved commit. The command includes JSON schemas directly under `schemas/` and under `schemas/lifecycle/`, and skips `schemas/vendor/` and the deprecation register data file. A newly added schema file is additive. A removed release file or a changed canonical `$id` breaks its published address. The command works offline and is a development tool in the checkout.

## Change classes

| Class | Before | After | Draft requirement |
| --- | --- | --- | --- |
| Breaking | `"required": ["observedAt"]` | `"required": ["observedAt", "method"]` rejects older records without `method`. | [ELF-VERSION-02](https://velella.sh/ebb/spec/1.0/versioning/#elf-version-02) |
| Additive | `"enum": ["manual"]` | `"enum": ["manual", "imported"]` still accepts the earlier value. | [ELF-VERSION-02](https://velella.sh/ebb/spec/1.0/versioning/#elf-version-02) |
| Editorial | `"description": "Rule date."` | `"description": "Date the rule was observed."` clarifies an annotation. | [ELF-VERSION-05](https://velella.sh/ebb/spec/1.0/versioning/#elf-version-05) |
| Unknown | `"oneOf": [{ "type": "string" }]` | `"oneOf": [{ "type": "string" }, { "const": "manual" }]` requires checking branch overlap. | [ELF-VERSION-05](https://velella.sh/ebb/spec/1.0/versioning/#elf-version-05) |

The tool handles required fields, enums, standard types, simple numeric and length bounds, and property changes where its surrounding rules make them unambiguous. It resolves JSON Pointer references into first-party local files. Changed external, unresolved or unsupported reference forms are unknown. Replacing a pattern, adding a typed property to a previously open object, changing an exclusive branch, or changing an unsupported keyword requires a semantic review. Classifications describe the changed constraints. Check real instances when surrounding schemas can interact through a reference or an exclusive branch. Use the draft [JSON Schema core](https://json-schema.org/draft/2020-12/json-schema-core) and [validation vocabulary](https://json-schema.org/draft/2020-12/json-schema-validation) for keyword interactions.

## Observed from npm 0.2.0

The published [npm tarball](https://registry.npmjs.org/@velella/ebb/-/ebb-0.2.0.tgz) matched the registry SHA-512 integrity and all six first-party schema files in Git tag [v0.2.0](https://github.com/velella-sh/ebb/tree/e952e3e6f5eaa4e322ef9fccc6bec224cf306df9/schemas). The tarball's `package/registry/osv.json` has SHA-256 `b1f509536d07c39b78836eb04739a630789d257409d218ad38dd9b58d3f94d85`.

Ajv 2020-12 accepted that untouched registry file against the published `registry.v2` schema. The current schema rejects its missing `provenance.method` under the same canonical URI. Adding an object-valued `x-ical: {}` to the published fixture was also accepted by the old extension rule and rejected by the current `x-ical.sequence` schema. These changes predate the advisory workflow.

The [read-only PR workflow](https://github.com/velella-sh/ebb/actions/workflows/schema-evolution.yml) records all findings in its job summary while this historical drift is reviewed. It fails when the baseline or comparison cannot run. Required enforcement and the remediation plan remain tracked in [#841](https://github.com/velella-sh/ebb/issues/841) and [#936](https://github.com/velella-sh/ebb/issues/936).

## Propose a deprecation

For example, a proposal for a hypothetical `schemas/example.schema.json#/properties/hint` could name `message` as its replacement, announce the deprecation in package `0.3.0`, and continue accepting `hint` throughout the compatible line. It could propose `1.0.0` as the earliest removal, subject to [ELF-VERSION-03](https://velella.sh/ebb/spec/1.0/versioning/#elf-version-03). These details will be recorded in the approved register tracked in [#893](https://github.com/velella-sh/ebb/issues/893). This example does not announce an actual removal.
