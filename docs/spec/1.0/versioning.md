---
title: Format versioning and extensions
description: Draft lifecycle format compatibility policy.
layout: doc
permalink: /spec/1.0/versioning/
---

This chapter proposes the compatibility policy for the specification. The [changelog](https://velella.sh/ebb/spec/changelog/) identifies the unpublished release candidate. The [schema compatibility work](https://github.com/velella-sh/ebb/issues/841) and [release candidate](https://github.com/velella-sh/ebb/issues/908) are tracked separately.

### ELF-VERSION-01

The specification MUST use semantic versioning and identify a release by its specification version. Wire formats retain their declared identifiers. For example, a registry declares `schemaVersion: "ebb.registry.v2"` and a bundle declares its version in `manifest.schemaVersion`. A JSON Schema document uses `$schema` for the JSON Schema dialect and `$id` for its schema identity. An instance includes a `$schema` pointer only where its own contract permits one. A standalone rule inherits its schema from the registry or distribution it came from.

### ELF-VERSION-02

A minor or patch specification release MUST keep documents accepted under the earlier compatible specification valid. Removing a field, narrowing an enum, adding a required field, tightening a type or pattern, and removing a permitted extension are breaking schema changes when they reject a previously accepted document. A semantic change that alters what a previously valid document means can also require a major version.

### ELF-VERSION-03

A producer of specification releases MUST announce a deprecation in an earlier published version before removing the deprecated contract in a major release. Release CI is intended to check schema compatibility against the last compatible publication and check deprecation notices for breaking changes. This draft has no previous 1.0 publication to check against. The [schema evolution report](https://velella.sh/ebb/schema-evolution/) compares the current package schemas against the last tagged package release. The published deprecation register and frozen-schema gate are tracked separately.

### ELF-VERSION-04

A producer MAY add an object-valued `x-<name>` extension in a position that permits it. An extension MUST agree with the rule's required fields. A core consumer MUST ignore an extension it does not understand. A consumer claiming an extension profile must apply the additional profile requirements.

### ELF-VERSION-05

The proposed schema comparison records changes as breaking when they remove an accepted value or a published contract address, additive when they expand the accepted contract, and editorial when they affect only annotations. An undecidable change is unknown and requires semantic review before it can pass a compatibility gate. For example, a new branch in `oneOf` can overlap an existing branch and reject documents that previously matched exactly once.
