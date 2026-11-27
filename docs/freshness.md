---
title: "Data freshness policy"
description: "How Ebb measures data age, flags stale lifecycle rules, and ensures CI runs with up-to-date evidence."
layout: doc
permalink: /freshness/
---

Ebb is designed around evidence and trust. Lifecycle rules are only as good as their freshness. Outdated rules risk advising migrations on obsolete assumptions or missing newly deprecated packages.

To protect against quiet obsolescence, Ebb enforces a strict **Data Freshness Policy** across all its interfaces (CLI, GitHub Action, Static API, and SDK).

## How data age is computed

Ebb calculates the age of the lifecycle rules currently in use using `dataStatus()`:

$$\text{ageDays} = \max\left(0, \lfloor(\text{now} - \text{basis}) / 86400000\rfloor\right)$$

Where `basis` is:
- **`createdAt`** (ISO 8601 UTC timestamp) for downloaded bundles (`ebb update`).
- **`reviewedThrough`** (ISO calendar day) for bundled data shipped with the package release.

Every query, CLI check, and Action summary displays this basis and the resulting age in whole calendar days.

## Freshness thresholds and stale warnings

By default, evidence older than **30 days** is classified as `stale`:

```bash
ebb data-status
```

Output:
```text
Lifecycle data status:
  Source:           bundled (0.2.0)
  Reviewed through: 2026-11-15
  Data age:         3 days
  Freshness limit:  30 days
  Status:           fresh
```

When data exceeds the threshold:
- `dataStatus().stale` becomes `true`.
- A warning message is attached to `warnings`:
  `Data is 35 days old (exceeds 30d freshness threshold). Run 'ebb update' to refresh.`
- The CLI command `ebb data-status` exits with code `1`.
- A warning banner appears in CLI text, Markdown, and GitHub Action summaries.

### Configuring the threshold

You can adjust the freshness threshold to match your team's compliance window:

1. **Environment variable:**
   ```bash
   export EBB_DATA_MAX_AGE_DAYS=14
   ```

2. **CLI flag:**
   ```bash
   ebb data-status --max-age 14
   ebb check node 18.20.4 --max-age 14
   ```

3. **Programmatic option:**
   ```ts
   import { dataStatus } from "@velella/ebb/data-status";

   const status = dataStatus({ maxAgeDays: 14 });
   if (status.stale) {
     console.warn(`Data is ${status.ageDays}d old!`);
   }
   ```

## Keeping data fresh in CI

To ensure CI pipelines and automated scans always evaluate packages against fresh lifecycle data:

### 1. In GitHub Actions (`velella-sh/ebb`)

The official GitHub Action automatically runs with bundled or cached data. To update data prior to batch evaluation, run an update step:

```yaml
- name: Run Ebb Lifecycle Check
  uses: velella-sh/ebb@v0.4.0
  with:
    file: package.json
    fail-on: deprecated
```

### 2. In CLI shell scripts

Run `ebb update` or `ebb update --check` before your test and scan suites:

```bash
# Check if a signed newer bundle is available
ebb update --check

# Download, verify with Sigstore, and apply
ebb update
```

### 3. Caching downloaded bundles

Ebb stores verified bundles in `~/.cache/ebb/data` (Linux) or `~/Library/Caches/ebb/data` (macOS). Cache this directory between CI jobs to avoid redundant network downloads:

```yaml
- name: Cache Ebb data
  uses: actions/cache@v4
  with:
    path: ~/.cache/ebb
    key: ebb-data-\{{ runner.os }}-\{{ steps.date.outputs.date }}
```

## Automated source health and verification

The automated source check verifies that cited evidence URLs remain reachable and that documented dates continue to appear in upstream sources. It does not replace a human review: a passing check proves the citation is alive, but only a human maintainer can confirm that surrounding text or policy changes have not altered the underlying meaning.

### Source health statuses

Each cited source tracked by Ebb is evaluated against the following report statuses:

- **`ok`**: The source is reachable (HTTP 200), unchanged, and confirms rule claims.
- **`archived-only`**: The primary source is unreachable, but a verified snapshot exists at the recorded archive URL confirming the date.
- **`changed`**: The source has permanently redirected, updated its title, or changed structure from the locked reference.
- **`date-changed`**: A structured JSON source with a pointer resolved to a date that differs from the rule's recorded deadline.
- **`date-missing`**: The rule records a deadline date, but that date was not found in the source text or HTML.
- **`unreachable`**: The server returned an HTTP error (404, 500) or timed out, and no archive fallback is available.
- **`blocked`**: The source returned an anti-bot challenge (such as Cloudflare or HTTP 403) and cannot be verified automatically.
- **`unrecorded`**: The source is cited in a rule but not yet locked in `registry/sources.lock.json`.
- **`stale`**: The rule has not undergone human review within its registry's configured review window (`maxReviewAgeDays`).

### Current source health counts

<!-- ebb-source-status-counts:start -->
| Status | Count | Description |
|---|---|---|
| `ok` | 354 | Reachable and verified unchanged |
| `archived-only` | 0 | Unreachable primary, verified via archive snapshot |
| `changed` | 0 | Title or URL redirected |
| `date-changed` | 0 | Structured pointer value differs from rule date |
| `date-missing` | 0 | Stated deadline not found in source text |
| `unreachable` | 0 | HTTP error or connection timeout |
| `blocked` | 0 | Anti-bot challenge or unverified response |
| `unrecorded` | 178 | Cited in a rule but not yet locked |
| `stale` | 0 | Past human review freshness window |
<!-- ebb-source-status-counts:end -->

