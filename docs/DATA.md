---
title: "Lifecycle data: updates, signing, and trust"
description: "Offline-first lifecycle data, Sigstore keyless verification, signed bundle trust model, and cache pinning."
layout: doc
permalink: /data/
---

Ebb's rules live in `registry/`. Every release of `@velella/ebb` ships them, so they are always available offline. Between package releases the same rules are published as signed **data bundles**, so a consumer can fetch newer rules and prove they came from this repository's release workflow. This page explains how that works, what is checked, and what Ebb promises.

> [!IMPORTANT]
> Downloaded data bundles are cryptographically verified via Sigstore keyless signatures before being loaded into cache. If verification fails, Ebb falls back immediately to its trusted bundled data.

## What you can rely on

- **Reading data never uses the network.** Loading rules, looking up a purl, and verifying a bundle read local files only. The only function that connects to anything is `updateData()` (`@velella/ebb/data-update`), and it runs only when the caller calls it.
- **Downloaded data is verified before it is used, every time it is loaded.** If it cannot be verified, Ebb uses the data shipped with the installed package and says why. It never loads data it could not verify.
- **The age of the evidence is visible.** `getDataStatus()` reports which data is active, where it came from, and how old it is, and marks it stale after 30 days.
- **The data version can be pinned** for reproducible results.
- **No account, no telemetry.** Updating asks a public release list and downloads public files. Nothing about the caller is sent.

## Using it from code

```ts
import { updateData } from "@velella/ebb/data-update";
import { configureActiveData, getActiveData } from "@velella/ebb/data-source";
import { getDataStatus } from "@velella/ebb/data-status";

await updateData();                                  // fetch and verify the newest signed bundle
await updateData({ version: "2026.10.01" });         // fetch exactly that bundle, without making it active
configureActiveData({ pinnedVersion: "2026.10.01" }); // use exactly that bundle ("bundled" for the shipped data)
const data = await getActiveData();                  // what lookup, check, and exports read
const status = await getDataStatus();                // source, version, age, stale flag
```

The active data has one of three sources: **bundled** (shipped with the package), **cache** (the newest verified download), or **pinned** (the version asked for). Its age is counted from when a downloaded bundle was built, or from the newest review date among the rules for bundled data. Anything Ebb refused on the way is in the active data's `warnings`. `check` stays synchronous: it resolves the same active set through a sync path over local files only, never the network.

### Updating

`updateData()` lists this repository's `data-v…` releases, picks the newest one that has a bundle and a signature, downloads both (https only, with size limits and timeouts), verifies them completely, and only then stores them in the cache and makes them active. If anything is wrong the previous data stays active and nothing is written.

It refuses a bundle that is older than the active one (a replayed old bundle would roll the rules back), a bundle the installed package already beats, and anything that fails verification. Three bundles are kept.

Downloads honor `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` (Node.js 22.21 or newer). To use a mirror, point `EBB_DATA_URL` at its release list.

### Pinning

A pin selects exactly bundle `X` from the cache, or `bundled` for the data shipped with the package. Unlike the automatic choice, a pin that cannot be met throws a `DataPinError` instead of quietly using something else; its `missing` flag says the bundle is not in the cache yet, so the caller can tell the user to download it. A pinned bundle is verified like any other and is used whatever its age.

### Where the data is stored

`EBB_DATA_DIR` if set, otherwise `~/Library/Caches/ebb` (macOS), `$XDG_CACHE_HOME/ebb` or `~/.cache/ebb` (Linux), or `%LOCALAPPDATA%\ebb\Cache` (Windows). Inside, `data/<version>/` holds `bundle.json` and its signature `bundle.json.sigstore.json`, and `data/active.json` names the active version. Deleting the directory returns Ebb to the bundled data.

## What is in a bundle

Ebb data bundles package lifecycle registries, GitHub Actions SHA maps, and OSV cross-references (`registry/osv.json`) into content-addressed archives:

- **Bundle v2 (`ebb.data-bundle.v2`)**: Includes a monotonically increasing `sequence` number for rollback protection, UTC `createdAt` timestamp, per-file digests and sizes, and a `digestList` for fast delta diffing. Also supports optional gzip compression (`.json.gz` saving >70% transfer size) and scoped per-ecosystem bundles. See [bundle.v2.schema.json](https://github.com/velella-sh/ebb/blob/main/schemas/bundle.v2.schema.json).
- **Bundle v1 (`ebb.data-bundle.v1`)**: The initial format ([schema](https://github.com/velella-sh/ebb/blob/main/schemas/data-bundle.v1.schema.json), [decision record](/decisions/0006-data-bundle/)). Ebb maintains full backward compatibility and reads both v1 and v2 bundles cleanly.

Building the bundle is deterministic: the same registry files and build parameters yield identical bytes.

### OSV advisories

`registry/osv.json` maps lifecycle rule ids to OSV advisory identifiers that have **no fixed version** for that package. The `osv` [importer](/importers/) drafts those rows at maintainer time from the OSV API; reading the data never calls OSV.

## Trust model and verification

A bundle is signed with **Sigstore keyless signing**. There is no long-lived signing key to steal or lose: the release workflow proves who it is to Sigstore with a short-lived GitHub identity token, receives a certificate that lasts minutes, signs the bundle, and the signature is recorded in a public transparency log.

Ebb accepts a bundle only if **all** of these hold, checked offline:

1. The signature verifies against the exact bytes downloaded (certificate chain, validity period, transparency-log inclusion).
2. The signer is this repository's release workflow: issuer `https://token.actions.githubusercontent.com` and an identity matching

   ```text
   ^https://github\.com/velella-sh/ebb/\.github/workflows/data-release\.yml@refs/(?:tags/data-v\d{4}\.\d{2}\.\d{2}(?:\.\d+)?|heads/main)$
   ```

   A valid signature from any other workflow, repository, or branch is refused.
3. The format is one Ebb understands (v1 or v2) and its `minimumEbbVersion` is not newer than the installed package.
4. The bundle is complete, and every file matches its digest and size, with nothing missing or extra.
5. **Rollback guard**: A bundle with a sequence number, creation date, or version older than the currently active data is rejected to prevent rollback attacks.

### Verification API

Cryptographic bundle verification is exported from the `@velella/ebb/verify` subpath:

```ts
import { verify, refreshTrustedRoot } from "@velella/ebb/verify";

// Verify offline with bundled Sigstore trusted root
const { bundle, signer } = verify(bundleBytes, signatureJson);
console.log(`Verified bundle ${bundle.manifest.version} signed by ${signer.identity}`);

// Optionally refresh trusted root CA safely
refreshTrustedRoot(customTrustedRootJson);
```

### CLI verification

Verify any downloaded bundle or release artifact directly using the CLI:

:::terminal
$ ebb verify dist/data/bundle.json
Verified: dist/data/bundle.json
Status: valid
Signer: https://github.com/velella-sh/ebb/.github/workflows/data-release.yml@refs/heads/main
Issuer: https://token.actions.githubusercontent.com
Version: 2026.10.16 (ebb.data-bundle.v2)
Sequence: 1
Digest: sha256:7f...
Files: 26
:::

Or output machine-readable JSON:

:::terminal
$ ebb verify dist/data/bundle.json --signature dist/data/bundle.json.sigstore.json --json
:::

The certificates and log keys come from the Sigstore public-good trusted root, which ships in the package (`data/sigstore-trusted-root.json`) so that verification needs no network. That is also why consumers should keep Ebb reasonably current: if Sigstore rotates its keys and the root in the installed package is too old, signatures made after the rotation stop verifying. Ebb then falls back to its bundled data and says so; it does not skip the check.

To check a release by hand with [cosign](https://docs.sigstore.dev/):

:::terminal
$ cosign verify-blob \
  --bundle ebb-data-2026.10.16.json.sigstore.json \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github\.com/velella-sh/ebb/\.github/workflows/data-release\.yml@refs/(?:tags/data-v\d{4}\.\d{2}\.\d{2}(?:\.\d+)?|heads/main)$' \
  ebb-data-2026.10.16.json
:::

### What this does not protect against

- A compromise of the repository's release workflow or of a maintainer with permission to push a `data-v…` tag: the workflow would sign whatever it was given. Rule changes are reviewed before they reach `main`, and the signature proves where a bundle came from, not that its contents are correct.
- A compromised `@velella/ebb` package: the trusted root and the signer identity are part of the package you installed.
- Wrong evidence. Signing says who published a rule, not that the claim is true; each rule cites its sources and review date for that reason.

### Release log

Every data release also publishes `release-log.jsonl`, a tamper-evident log of all data releases so far, with its own keyless signature (`release-log.jsonl.sigstore.json`). Each line is one release: version, `contentDigest`, the SHA-256 of the bundle file, the build time, the hash of the previous line, and its own hash. Because every entry commits to the one before it, changing, removing, or reordering a past release changes every later hash.

The release workflow downloads the previous release's log, refuses one that does not verify, appends the new bundle, and requires the result to extend the old log before signing it.

Check a log, and optionally that it extends an older copy you kept:

```bash
gh release download data-vYYYY.MM.DD --repo velella-sh/ebb --pattern 'release-log.jsonl*'
node dist/tools/data-release-log.js check release-log.jsonl --previous older-release-log.jsonl
```

## Updating lifecycle data (`update` and `rollback`)

Ebb separates software release lifecycles from data releases. You do not need to install a new npm package release to get fresh lifecycle rules.

### Safe, atomic update

```ts
import { update, rollback } from "@velella/ebb";

// Fetch the newest verified data release
const result = await update();
console.log(result.status); // "updated" | "up-to-date"
console.log(result.to.version); // e.g. "2026.10.20"

// Check for updates without downloading
const check = await update({ check: true });
if (check.status === "update-available") {
  console.log(`Update available: ${check.to.version}`);
}

// Roll back to previous cached data or bundled data
const reverted = await rollback();
console.log(reverted.status); // "rolled-back"
```

CLI:
```bash
# Update active lifecycle data
ebb update

# Check for updates without writing to disk
ebb update --check

# Roll back to the previous version
ebb update --rollback
```

### Safety guarantees
- **Zero network on import:** Ebb never checks for updates automatically or phones home. Network requests occur solely when `update()` or `ebb update` is explicitly called.
- **Offline signature verification:** The downloaded bundle is completely verified against Sigstore before anything is written to the user cache.
- **Atomic staging:** Downloads stage into an isolated PID-tagged directory and swap via atomic filesystem rename, ensuring no half-written state if interrupted.
- **Rollback protection:** Downgrading to older sequence numbers or timestamps is rejected unless `--allow-downgrade` is provided.

---

## Comparing data releases (`diff`)

`diff()` compares two lifecycle data versions, bundles, dates, or active data and reports all added, changed, removed, and renamed rules with field-level delta tracking.

```ts
import { diff, formatDiffMarkdown } from "@velella/ebb";

// Compare two releases
const result = await diff("2026.10.01", "2026.10.16");
console.log(result.summary); // { added: 12, changed: 3, removed: 0, renamed: 1 }

// Generate Markdown release notes
const markdown = formatDiffMarkdown(result);
console.log(markdown);
```

### CLI diff
```bash
# Compare bundled data to active data
ebb diff

# Compare two versions
ebb diff 2026.10.01 2026.10.16

# Generate Markdown release notes
ebb diff 2026.10.01 2026.10.16 --format markdown
```

### Renamed rule tracking
`diff` identifies renamed rules both from explicit declarations (`renamedFrom`, `x-renamed-from`) and heuristically when a rule in the same ecosystem retains its package URL and event under a new identifier, preventing false churn in release notes.

## License and attribution

Ebb's code is [MIT](https://github.com/velella-sh/ebb/blob/main/LICENSE). The data, meaning the registry JSON under `registry/` and the schemas under `schemas/`, is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) ([`LICENSE-DATA`](https://github.com/velella-sh/ebb/blob/main/LICENSE-DATA)), which allows use and redistribution, including commercially, with attribution and an indication of changes. See [`ATTRIBUTION.md`](../ATTRIBUTION.md).

To reuse the dataset, credit it and link the license, for example:

> Lifecycle data from Ebb (`@velella/ebb`), by Armin Azimi and Ebb contributors, licensed under CC BY 4.0. https://github.com/velella-sh/ebb

Every rule carries its own `sources` (title, URL, and the `accessedAt` day it was read) and `reviewedAt`, so a consumer can trace a claim back to the page that states it and the date it was retrieved. `registry/sources.lock.json` records the current title and final URL of each cited page for maintainers and stays out of the published package. The upstream facts remain subject to the terms of the pages they come from; the license covers Ebb's selection, arrangement, normalization, and original text. Product and project names are trademarks of their owners and do not imply endorsement.

## Publishing a bundle

Push a `data-vYYYY.MM.DD` tag (or `data-vYYYY.MM.DD.N` for a second bundle on the same day). [`data-release.yml`](https://github.com/velella-sh/ebb/blob/main/.github/workflows/data-release.yml) builds the bundle twice and requires identical bytes, signs it, verifies the signature, extends the release log, and attaches the bundle, the signatures, and checksums to a GitHub release that is never marked "Latest". A manual run of the workflow is a dry run that keeps the files as an artifact.
