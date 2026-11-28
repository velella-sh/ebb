---
title: Version matching and historical evaluation
description: Component identity, VERS containment and precise coverage results.
layout: doc
permalink: /spec/1.0/matching/
---

### ELF-MATCH-01

A consumer MUST compare canonical component identities according to the [Package URL specification](https://github.com/package-url/purl-spec). For lifecycle matching, retain the PURL type, namespace and name. Ignore the version, all qualifiers, and subpath for the identity comparison. Evaluate the version separately. For example, `pkg:npm/left-pad@1.3.0?repository_url=https%3A%2F%2Fregistry.npmjs.org#src` has the same component identity as `pkg:npm/left-pad`.

### ELF-MATCH-02

A consumer MUST use the scheme in the rule's [VERS range](https://github.com/package-url/vers-spec/tree/v1.2.1) to evaluate the version. A version that the applicable scheme cannot parse or compare MUST produce an indeterminate or invalid-input result. The consumer MUST distinguish it from a successful comparison outside the range. For example, `1.25.4` is inside `vers:golang/>=1.25.0|<1.26.0`, `1.26.0` is outside, and `not-a-version` cannot be compared in that scheme.

### ELF-MATCH-03

A consumer MUST distinguish an affected version with one or more matching rules, a known component with no matching rule for the version, and an unknown component with no applicable known rules for any version. A consumer MUST NOT present missing coverage as evidence of support. For example, Go 1.25.4 is affected by its end-of-support rule, Go 1.26.0 is known without a matching version rule in the current example snapshot, and `pkg:npm/ebb-spec-unknown-example` has no known component rules.

### ELF-MATCH-04

For package-level evaluation, a consumer MUST exclude a symbol-only rule from the component's lifecycle verdict. A symbol-specific rule applies in an evaluation that has the corresponding usage context. For example, a rule for the Python symbol `datetime.utcnow` describes the affected call. It does not establish that the whole Python release is deprecated.

### ELF-MATCH-05

A consumer that offers a historical projection MUST interpret `asOf` as a valid UTC calendar day and exclude rules whose `provenance.observedAt` falls after it. It MAY derive an effective historical event from an announced deadline and the requested day. It MUST preserve the event stored in the source rule and keep any [prediction](predictions.md) out of this calculation. A countdown for a fixed snapshot may also use an explicit reference day without creating a historical projection.

For example, the Ebb historical projection for Node.js 22 retains `scheduled` on 29 April 2027 and returns a projected `end-of-life` on 30 April 2027. Both evaluate the unchanged `scheduled-end-of-life` source rule. A fixed-snapshot evaluation continues to show its stored scheduled event and uses its deadline for the countdown.

## Conformance examples

The examples use the current repository's rules. Each cites the requirement it exercises.

```json
[
  {"requirement":"ELF-MATCH-01","purl":"pkg:npm/left-pad@1.3.0?repository_url=https%3A%2F%2Fregistry.npmjs.org#src","version":"1.3.0","kind":"affected","status":"deprecated"},
  {"requirement":"ELF-MATCH-02","purl":"pkg:generic/golang","version":"not-a-version","kind":"invalid-version"},
  {"requirement":"ELF-MATCH-03","purl":"pkg:generic/golang","version":"1.25.4","kind":"affected","status":"unsupported"},
  {"requirement":"ELF-MATCH-03","purl":"pkg:generic/golang","version":"1.26.0","kind":"no-match","status":"ok"},
  {"requirement":"ELF-MATCH-03","purl":"pkg:npm/ebb-spec-unknown-example","version":"1.0.0","kind":"unknown","status":"ok"},
  {"requirement":"ELF-MATCH-05","purl":"pkg:generic/nodejs","version":"22.12.0","asOf":"2026-10-23","kind":"unknown-at-date","status":"ok"},
  {"requirement":"ELF-MATCH-05","purl":"pkg:generic/nodejs","version":"22.12.0","asOf":"2027-04-29","kind":"historical","status":"scheduled"},
  {"requirement":"ELF-MATCH-05","purl":"pkg:generic/nodejs","version":"22.12.0","asOf":"2027-04-30","kind":"historical","status":"end-of-life"},
  {"requirement":"ELF-MATCH-05","purl":"pkg:generic/nodejs","version":"22.12.0","asOf":"2027-04-30","kind":"snapshot","status":"scheduled"}
]
```

## Comparison with current implementation

| Behavior | Current implementation |
| --- | --- |
| Coverage result | The version-check result uses `ok` for both a known component with no matching rule and an unknown PURL. The candidate index distinguishes the two before comparing versions. |
| Version parsing | The version checker trims whitespace and removes a leading `v` and build metadata before comparing. A bounded comparison propagates an invalid-version error. The current wildcard containment path matches without invoking a scheme comparator. |
| Evaluation date | The version checker's optional `asOf` parameter is a countdown reference. The separate historical projection filters evidence by observation day and can present an effective event. Neither edits the stored rule. |
| Display ordering | The wire-event precedence is described in the [event chapter](events.md#elf-event-03). The legacy result projects scheduled end of life, end of active support and end of extended support onto the same `scheduled` result value, so those results are ordered by deadline. |

These differences remain open follow-up work in the [matching chapter issue](https://github.com/velella-sh/ebb/issues/896). The [prediction profile](https://github.com/velella-sh/ebb/issues/885) and [event conformance vectors](https://github.com/velella-sh/ebb/issues/912) are tracked independently.
