---
title: Distribution and signatures
description: Registry and bundle formats, content hashes, and Sigstore verification.
layout: doc
permalink: /spec/1.0/distribution/
---

### ELF-DIST-01

A registry MUST declare `schemaVersion: "ebb.registry.v2"`, its `ecosystem`, and a `rules` array. The optional `freshness.maxReviewAgeDays` is a review threshold. Registry rules MUST satisfy the [rule and evidence requirements](rule.md). [Registry v2 schema](https://github.com/velella-sh/ebb/blob/main/schemas/registry.v2.schema.json)

### ELF-DIST-02

A consumer claiming the bundle profile MUST read and validate the declared bundle format. A bundle carries a `manifest` and `files` keyed by path. The manifest records the bundle format, release version, minimum Ebb implementation version, UTC creation time, content digest and per-file entries. Bundle v2 adds a sequence number. It may also carry an ecosystem scope and digest indexes. Each published release uses the tag `data-vYYYY.MM.DD`, with `.N` for a same-day revision. [Bundle v1 schema](https://github.com/velella-sh/ebb/blob/main/schemas/data-bundle.v1.schema.json) · [Bundle v2 schema](https://github.com/velella-sh/ebb/blob/main/schemas/bundle.v2.schema.json) · [Decision 0006](../../decisions/0006-data-bundle.md)

### ELF-DIST-03

A consumer MUST check the bundle's declared file set, sizes, SHA-256 digests and registry validity. The per-file digest is calculated over canonical UTF-8 JSON. Sort object keys by UTF-16 code units at each level, retain array order, encode strings with JSON string escaping, write safe integers in decimal, and omit insignificant whitespace. Compute the manifest's `contentDigest` over the UTF-8 concatenation of `<path> <sha256>\n` lines sorted by path, and prepend `sha256:` to the hex result. The transport SHA-256 of the downloaded file covers its exact bytes instead.

### ELF-DIST-04

A consumer accepting a signed bundle MUST verify the detached Sigstore bundle against the downloaded bytes, a trusted issuer, and the expected publisher identity. Ebb data releases use the issuer `https://token.actions.githubusercontent.com` and the `velella-sh/ebb` data-release workflow on `main` or a data release tag. A failed identity or signature check MUST prevent acceptance. A consumer installing an update MUST enforce its supported format and rollback rules. [Data bundle verification](../../DATA.md#trust-model-and-verification)

## Verify a published Ebb bundle

Run these commands in an empty directory with GitHub CLI, Cosign and `shasum` installed. The example uses the public release verified on 2026-11-28. For a later release, use its exact tag and matching artifact names.

```bash
tag=data-v2026.11.11
bundle=ebb-data-2026.11.11.json
gh release download "$tag" --repo velella-sh/ebb \
  --pattern "$bundle" --pattern "$bundle.sigstore.json" --pattern SHA256SUMS
awk -v file="$bundle" '$2 == file { print }' SHA256SUMS | shasum -a 256 -c -
cosign verify-blob \
  --bundle "$bundle.sigstore.json" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github\.com/velella-sh/ebb/\.github/workflows/data-release\.yml@refs/(?:tags/data-v\d{4}\.\d{2}\.\d{2}(?:\.\d+)?|heads/main)$' \
  "$bundle"
```

The checksum and Cosign v3.1.6 returned these lines.

```text
ebb-data-2026.11.11.json: OK
Verified OK
```

The [static JSON API](../../static-api.md) is an optional way to distribute views of the rules. A format consumer can read the same rule shape from another distribution without implementing the Ebb endpoints.
