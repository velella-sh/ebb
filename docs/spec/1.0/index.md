---
title: Ebb Lifecycle Format 1.0 working draft
description: Scope, terminology and conformance for evidence-backed lifecycle data.
layout: doc
permalink: /spec/1.0/
---

This working draft describes lifecycle events for software components. A rule joins a Package URL to a VERS range and states what happened, which evidence supports it, and when the evidence was observed and reviewed. The format leaves vulnerability identifiers, licence obligations, and identity relationships beyond the Package URL to their own specifications.

## Terms

| Term | Meaning |
| --- | --- |
| Component | A package, platform or other software item identified by a Package URL. |
| Rule | A stable record of one lifecycle event for one component and one affected version range. |
| Event | A change in lifecycle state or an announced boundary in the support timeline. |
| Release line | A producer's named series of component releases. Its version range determines membership. |
| Prediction | A planning estimate for an unannounced date. The optional prediction format is still under review. |
| Declaration | An input that asserts a dependency on a component, with a specific version or a version constraint. |
| Producer | A party that creates or publishes records or distributions in the format. |
| Consumer | A party that reads or reports on a record or distribution. |

## Conformance

The uppercase requirement keywords in this draft have the meanings defined in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174.html). Each requirement heading has a stable identifier of the form `ELF-<section>-<n>`. A vector cites the uppercase identifier and links to its lowercase fragment. Examples and implementation notes are informative unless a requirement explicitly refers to them.

### ELF-SCOPE-01

A conforming producer MUST provide a rule for each lifecycle claim, with a component identity, an affected range and evidence. A conforming consumer MUST apply the requirements for the profiles it claims. Core conformance covers rule structure, the event vocabulary, evidence and version matching. The signed bundle profile adds the distribution verification requirements.

### ELF-SCOPE-02

Producers and consumers MUST identify the Lifecycle Format version independently from the version of any implementation package.

## Sections

| Section | Status |
| --- | --- |
| Scope, terms and conformance | This page |
| [Rule object](rule.md) | Current rule v2 contract |
| [Events](events.md) | Current events and ordering |
| [Matching](matching.md) | Current semantics and implementation comparisons |
| [Evidence and provenance](evidence.md) | Current evidence fields |
| [Distribution and signatures](distribution.md) | Current published formats |
| [Versioning and extensions](versioning.md) | Draft compatibility policy |
| [Predictions](predictions.md) | Draft optional profile |
| Component data profiles | [Pending work](https://github.com/velella-sh/ebb/issues/886) |
| Interchange mappings | [Pending work](https://github.com/velella-sh/ebb/issues/895) |

The [changelog](../CHANGELOG.md) records the draft status. [Release candidate publication](https://github.com/velella-sh/ebb/issues/908) is tracked separately.
