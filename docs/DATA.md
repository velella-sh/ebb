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

### Where the data is stored and cache layout

The cache directory is resolved per platform (`src/cache-paths.ts`):
- **macOS**: `~/Library/Caches/ebb`
- **Linux / other**: `$XDG_CACHE_HOME/ebb` or `~/.cache/ebb`
- **Windows**: `%LOCALAPPDATA%\ebb\Cache` (or `%USERPROFILE%\AppData\Local\ebb\Cache`)

The `EBB_DATA_DIR` environment variable overrides this path entirely on any platform.

#### Directory layout

Within the cache directory, lifecycle data is stored in the `data/` subdirectory:

```text
<cache-dir>/
└── data/
    ├── active.json                    # Points to the currently active version: {"version": "..."}
    ├── previous.json                  # Records previous active version for rollback: {"version": "..."}
    ├── release-log.jsonl              # Local append-only chain of verified releases
    ├── releases-etag.txt              # ETag from the last releases query for conditional HTTP requests
    ├── .lock                          # Concurrency lock during data updates
    └── <version>/                     # Versioned directory for each bundle (e.g. 2026.11.11/)
        ├── bundle.json                # Complete lifecycle data bundle (rules, registries, shas)
        └── bundle.json.sigstore.json  # Sigstore keyless signature bundle
```

#### What `update` and `rollback` write

- **`update`** (`src/data-update.ts`):
  1. Acquires a file lock (`data/.lock`) to prevent concurrent updates from racing or corrupting the cache.
  2. Stages the downloaded bundle and signature atomically in `<cache-dir>/data/<version>/` via a temporary staging directory (`<version>.<pid>.new`).
  3. Preserves the currently active version in `data/previous.json` before switching.
  4. Atomically writes the new active version pointer to `data/active.json`.
  5. Updates the local `data/release-log.jsonl` if the release supplies a verified log.
  6. Stores the HTTP `ETag` in `data/releases-etag.txt` to avoid redundant downloads on subsequent checks.
  7. Prunes older cached versions, retaining the 3 most recent bundles.
  8. Releases the lock.
- **`rollback`** (`src/data-update.ts`):
  1. Acquires the file lock.
  2. Reads `data/previous.json` (or inspects `data/` for the most recent earlier cached version).
  3. Points `data/active.json` to the previous version and removes `data/previous.json`. If no earlier cached version exists, removes both `data/active.json` and `data/previous.json` so Ebb falls back to bundled data shipped with the package.
  4. Releases the lock.

Deleting the cache directory or clearing it with `ebb cache clear` returns Ebb to using the bundled data.

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

You can follow data releases in four ways:
1. **[Changelog page](/data-changelog/)**: Full release notes with links to rule definitions.
2. **[Atom feed](/data-changelog.atom)**: Real-time syndication feed.
3. **CLI [`ebb release-log`](/cli#ebb-release-log-options)**: Inspect local release history and digests.
4. **Static API [`/releases.json`](/static-api)**: Machine-readable release listing with change counts.

During `updateData()`, downloaded release logs are verified before being accepted into cache. Any alteration, removal, or reordering of prior releases fails the update and leaves local data intact.

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

Ebb publishes lifecycle data bundles automatically on a weekly schedule and on demand. The release pipeline is orchestrated by [`.github/workflows/data-release.yml`](https://github.com/velella-sh/ebb/blob/main/.github/workflows/data-release.yml).

### Weekly schedule and change detection

- **Schedule**: The workflow runs automatically every Wednesday at 07:00 UTC (`0 7 * * 3`), after the Monday source-freshness check and Tuesday importers.
- **Branch protection**: Scheduled runs execute exclusively against the `main` branch.
- **Change detection**: Before building, the workflow checks `tools/data-release-needed.js` against the latest entry in `release-log.jsonl`. If the bundle content digest is unchanged, the workflow halts early without creating a release or noise.

### Release quality gates

Before building or signing any bundle, strict data quality gates must pass:
1. `npm run check` and rule linting (`npm run lint:rules`) must pass with zero errors.
2. The release downloads `source-report.json` from the latest completed source freshness run on `main` and validates it. The release stops if the report is unavailable, invalid, or contains any `date-changed` findings. The workflow records the reason in its step summary.

### Naming conventions and same-day releases

- **Standard name**: Dated by the release commit's UTC date as `YYYY.MM.DD` (for example, `2026.11.20`), corresponding to git tag `data-vYYYY.MM.DD`.
- **Same-day releases**: If a second or subsequent release is required on the same day, `.N` is appended (for example, `2026.11.20.1`, `2026.11.20.2`).
- **Ordering**: Version comparison treats unadorned dates as earlier than same-day revisions: `2026.11.20` < `2026.11.20.1` < `2026.11.20.2` < `2026.11.21`.

### Triggering a release by hand

You can trigger a data release manually in two ways:
1. **Pushing a tag**: Push a tag matching `data-vYYYY.MM.DD` or `data-vYYYY.MM.DD.N`.
2. **Workflow dispatch**: Run the workflow manually from the GitHub Actions tab or CLI:
   ```bash
   # Dry run (builds, signs, and uploads artifact out/ without publishing):
   gh workflow run data-release.yml -f dry_run=true

   # Live release:
   gh workflow run data-release.yml -f dry_run=false
   ```

### Post-release verification on a clean runner

After publishing a real release:
1. A fresh verification job (`verify`) spins up on a clean `ubuntu-latest` runner with no access to build files.
2. It installs `@velella/ebb` from npm and runs `ebb update` and `ebb verify`.
3. If either update or cryptographic verification fails, the job fails loudly.

### Shipping fresh data in the npm package

Following every published data release:
1. The workflow automatically prepares a patch release of `@velella/ebb` by incrementing the patch version in `package.json` and opening a pull request (`chore/data-${VERSION}`).
2. The PR description embeds the generated release notes and data diff summary.
3. Merging and publishing the npm package remains the responsibility of the repository maintainer.

### When a release fails

- **Automated issue tracking**: If a scheduled run fails at any step, the workflow creates an issue with label `area: release, priority: P0` citing the failing run and job status.
- **Deduplication**: If a failure issue is already open, subsequent failing scheduled runs add a comment to that issue rather than opening duplicate issues.
- **Automatic resolution**: When the next scheduled run succeeds, the open failure issue is closed automatically.
- **Manual dry runs**: Dry runs never open failure issues; inspect the Action execution logs directly.

### Correcting an errant release

Published data bundles are cryptographically signed, immutable, and appended to the transparency log and hash chain. Never attempt to delete or unpublish a released bundle. To correct errors in a published release, fix the underlying registry rules on `main` and publish a new data release (`YYYY.MM.DD.N`), which supersedes the earlier release and propagates cleanly via `ebb update`.

### npm distribution tags (`dist-tags`)

The npm package `@velella/ebb` follows strict tag rules:
- `latest` always points to the newest stable release.
- `next` is reserved exclusively for prereleases (e.g. `0.1.0-rc.1`) and is cleared or pointed to stable when a stable version is released.
- Release workflows never leave `next` pointing to an outdated prerelease when a newer stable version exists.
