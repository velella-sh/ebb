# Lifecycle data: updates, signing, and trust

Ebb's rules live in `registry/`. Every release of `@velella/ebb` ships them, so they are always available offline. Between package releases the same rules are published as signed **data bundles**, so a consumer can fetch newer rules and prove they came from this repository's release workflow. This page explains how that works, what is checked, and what Ebb promises.

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

One JSON file (`ebb.data-bundle.v1`, [schema](../schemas/data-bundle.v1.schema.json), [decision record](decisions/0006-data-bundle.md)) with a manifest and the data files: the lifecycle registries (one JSON file per ecosystem under `registry/`), the GitHub Actions SHA map, and the OSV cross-reference (`registry/osv.json`). The manifest lists each file's SHA-256, size, and rule count, a content address for the whole set, the build time, and the oldest Ebb version that can read it (`minimumEbbVersion`). Versions look like `2026.10.16`, with `.N` for a second bundle on the same day. Building the bundle is deterministic: the same registry files and build time give the same bytes.

### OSV advisories

`registry/osv.json` maps lifecycle rule ids to OSV advisory identifiers that have **no fixed version** for that package. The `osv` [importer](IMPORTERS.md) drafts those rows at maintainer time from the OSV API; reading the data never calls OSV.

## Trust model

A bundle is signed with **Sigstore keyless signing**. There is no long-lived signing key to steal or lose: the release workflow proves who it is to Sigstore with a short-lived GitHub identity token, receives a certificate that lasts minutes, signs the bundle, and the signature is recorded in a public transparency log.

Ebb accepts a bundle only if **all** of these hold, checked offline:

1. The signature verifies against the exact bytes downloaded (certificate chain, validity period, transparency-log inclusion).
2. The signer is this repository's release workflow: issuer `https://token.actions.githubusercontent.com` and an identity matching

   ```text
   ^https://github\.com/velella-sh/ebb/\.github/workflows/data-release\.yml@refs/(?:tags/data-v\d{4}\.\d{2}\.\d{2}(?:\.\d+)?|heads/main)$
   ```

   A valid signature from any other workflow, repository, or branch is refused.
3. The format is one Ebb understands and its `minimumEbbVersion` is not newer than the installed package.
4. The bundle is complete, and every file matches its digest and size, with nothing missing or extra.

The certificates and log keys come from the Sigstore public-good trusted root, which ships in the package (`data/sigstore-trusted-root.json`) so that verification needs no network. That is also why consumers should keep Ebb reasonably current: if Sigstore rotates its keys and the root in the installed package is too old, signatures made after the rotation stop verifying. Ebb then falls back to its bundled data and says so; it does not skip the check.

To check a release by hand with [cosign](https://docs.sigstore.dev/):

```bash
cosign verify-blob \
  --bundle ebb-data-2026.10.16.json.sigstore.json \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github\.com/velella-sh/ebb/\.github/workflows/data-release\.yml@refs/(?:tags/data-v\d{4}\.\d{2}\.\d{2}(?:\.\d+)?|heads/main)$' \
  ebb-data-2026.10.16.json
```

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

## License and attribution

Ebb's code is [MIT](../LICENSE). The data, meaning the registry JSON under `registry/` and the schemas under `schemas/`, is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) ([`LICENSE-DATA`](../LICENSE-DATA)), which allows use and redistribution, including commercially, with attribution and an indication of changes. See [`ATTRIBUTION.md`](../ATTRIBUTION.md).

To reuse the dataset, credit it and link the license, for example:

> Lifecycle data from Ebb (`@velella/ebb`), by Armin Azimi and Ebb contributors, licensed under CC BY 4.0. https://github.com/velella-sh/ebb

Every rule carries its own `sources` (title, URL, and the `accessedAt` day it was read) and `reviewedAt`, so a consumer can trace a claim back to the page that states it and the date it was retrieved. `registry/sources.lock.json` records the current title and final URL of each cited page for maintainers and stays out of the published package. The upstream facts remain subject to the terms of the pages they come from; the license covers Ebb's selection, arrangement, normalization, and original text. Product and project names are trademarks of their owners and do not imply endorsement.

## Publishing a bundle

Push a `data-vYYYY.MM.DD` tag (or `data-vYYYY.MM.DD.N` for a second bundle on the same day). [`data-release.yml`](../.github/workflows/data-release.yml) builds the bundle twice and requires identical bytes, signs it, verifies the signature, extends the release log, and attaches the bundle, the signatures, and checksums to a GitHub release that is never marked "Latest". A manual run of the workflow is a dry run that keeps the files as an artifact.
