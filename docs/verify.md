---
title: Verify an Ebb data release
description: Check the producer identity and contents of a published signed Ebb snapshot and release log.
layout: doc
permalink: /verify/
---

Ebb publishes and signs lifecycle data separately from the npm package. The data release workflow verifies each bundle and the accompanying release log with Sigstore Cosign before publication. The same checks can be run on the downloaded files.

## Verify the published snapshot and release log

This example uses [data-v2026.11.11](https://github.com/velella-sh/ebb/releases/tag/data-v2026.11.11). Run it in an empty directory with the [GitHub CLI](https://cli.github.com/) and [Cosign](https://docs.sigstore.dev/cosign/system_config/installation/) installed.

```bash
gh release download data-v2026.11.11 --repo velella-sh/ebb \
  --pattern 'ebb-data-2026.11.11.json*' \
  --pattern 'release-log.jsonl*' --pattern SHA256SUMS
sha256sum --check SHA256SUMS

issuer=https://token.actions.githubusercontent.com
identity='^https://github\.com/velella-sh/ebb/\.github/workflows/data-release\.yml@refs/(?:tags/data-v\d{4}\.\d{2}\.\d{2}(?:\.\d+)?|heads/main)$'
for artifact in ebb-data-2026.11.11.json release-log.jsonl; do
  cosign verify-blob --bundle "${artifact}.sigstore.json" \
    --certificate-oidc-issuer "$issuer" \
    --certificate-identity-regexp "$identity" "$artifact" || exit 1
done
```

Success requires `Verified OK` for both files. Replace the tag and bundle filename together when checking a newer data release. The identity and issuer limits come from the [data-release workflow](https://github.com/velella-sh/ebb/blob/main/.github/workflows/data-release.yml). The checksum checks transfer integrity. Cosign binds the bytes to Ebb's release workflow.

After verifying both signatures, compare the bundle's SHA-256 to the signed log's `bundleSha256` for that version. Consumers can use Ebb's [offline verification and chained release log](https://velella.sh/ebb/data/) with a package version that supports the bundle's format.

## Package build provenance

The package publishing workflow requests npm provenance. Verification of the exact published npm tarball, its GitHub build attestation and a post-publish CI run are tracked in [#755](https://github.com/velella-sh/ebb/issues/755) and [#776](https://github.com/velella-sh/ebb/issues/776). Those checks are separate from the signed data above.
