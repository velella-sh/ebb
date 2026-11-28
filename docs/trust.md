---
title: "Trust and Verification"
description: "Why Ebb lifecycle data can be trusted: evidence standards, machine checks, confidence scoring, and cryptographic signing."
layout: doc
permalink: /trust/
---

# Trust and Verification

Ebb publishes software lifecycle claims: when packages, runtimes, and tools reach end of life. Because security scanners, dependency managers, and AI coding agents make automated decisions based on this data, every claim must be verifiable.

This page documents how Ebb verifies claims, what machine checks enforce them, and where the limits lie.

---

## 1. Every Rule Has an Official Source

A rule in Ebb is not a subjective opinion or community guess. Every rule requires an authoritative source: a vendor end-of-life announcement, an official release schedule, or a package registry deprecation notice.

- **Schema enforcement**: The JSON Schema requires a non-empty `sources` array with valid URLs, titles, and access timestamps: [`schemas/registry.v2.schema.json`](https://github.com/velella-sh/ebb/blob/main/schemas/registry.v2.schema.json).
- **Validation**: Enforced on every pull request by `npm run lint:rules` via [`tools/changed-rules.ts`](https://github.com/velella-sh/ebb/blob/main/tools/changed-rules.ts).
- **Automated test**: Tested in [`tests/registry.test.ts`](https://github.com/velella-sh/ebb/blob/main/tests/registry.test.ts).

---

## 2. Every Rule Has a Named Reviewer

Every rule records an explicit maintainer audit trail under `provenance`:

- `reviewer`: The GitHub handle of the maintainer who verified the evidence against upstream documentation.
- `reviewedAt`: The date the rule was verified.
- `observedAt`: The date the upstream event was published or observed.

Unreviewed, anonymous, or placeholder reviewers are rejected by schema validation.

- **Schema definition**: [`schemas/rule.schema.json`](https://github.com/velella-sh/ebb/blob/main/schemas/rule.schema.json).
- **Linter test**: Verified by [`tests/rule-lint.test.ts`](https://github.com/velella-sh/ebb/blob/main/tests/rule-lint.test.ts).

---

## 3. Weekly Machine Checks

Evidence can drift: upstream links move, pages return 404s, or dates change. Ebb runs continuous automated health checks:

- **Source link and content audit**: Every evidence URL is pinned in [`registry/sources.lock.json`](https://github.com/velella-sh/ebb/blob/main/registry/sources.lock.json) with its final redirect URL and page title.
- **Continuous checking workflow**: [`.github/workflows/sources.yml`](https://github.com/velella-sh/ebb/blob/main/.github/workflows/sources.yml) runs [`tools/check-sources.ts`](https://github.com/velella-sh/ebb/blob/main/tools/check-sources.ts) weekly to flag moved, dead, or redirected sources.
- **Stale rule audit**: [`.github/workflows/stale-rules.yml`](https://github.com/velella-sh/ebb/blob/main/.github/workflows/stale-rules.yml) detects any rule whose review date exceeds the registry's review age window (default: 365 days).
- **Automated test**: Enforced in [`tests/stale.test.ts`](https://github.com/velella-sh/ebb/blob/main/tests/stale.test.ts).

---

## 4. Confidence Levels

Not all upstream claims have the same certainty. Ebb scores each rule with an explicit confidence level (`confirmed`, `likely`, or `estimated`) based on source authority and version precision:

- `confirmed`: Explicit vendor statement with an exact deadline and specific VERS version range.
- `likely`: Authoritative registry flag (e.g. npm deprecated flag) without a published schedule.
- `estimated`: Derived from cadence patterns or upstream roadmaps with estimated precision.

Evaluation logic and criteria are implemented in [`src/confidence.ts`](https://github.com/velella-sh/ebb/blob/main/src/confidence.ts), documented in [`docs/confidence.md`](confidence.md), and tested in [`tests/confidence.test.ts`](https://github.com/velella-sh/ebb/blob/main/tests/confidence.test.ts).

---

## 5. Cryptographically Signed Data Releases

Ebb publishes updated lifecycle data bundles independently of package releases. Every bundle is cryptographically signed using Sigstore Cosign. Follow the [verification guide](https://velella.sh/ebb/verify/) on a published data release or consult the [Scorecard result and plan](https://velella.sh/ebb/scorecard/).

- **Keyless signing**: Signed in GitHub Actions using OpenID Connect identity tokens in [`.github/workflows/data-release.yml`](https://github.com/velella-sh/ebb/blob/main/.github/workflows/data-release.yml).
- **Offline bundle verification**: Verification executes completely offline using the bundled Sigstore trusted root in [`data/`](https://github.com/velella-sh/ebb/blob/main/data/).
- **Verification engine**: Implemented in [`src/verify.ts`](https://github.com/velella-sh/ebb/blob/main/src/verify.ts) and [`src/data-signature.ts`](https://github.com/velella-sh/ebb/blob/main/src/data-signature.ts).
- **Automated test**: Tested in [`tests/verify.test.ts`](https://github.com/velella-sh/ebb/blob/main/tests/verify.test.ts) and [`tests/data-bundle.test.ts`](https://github.com/velella-sh/ebb/blob/main/tests/data-bundle.test.ts).

---

## Maintainer Disclosure and Project Limits

Ebb is currently maintained by a single primary maintainer ([@arminazimi](https://github.com/arminazimi)).

We do not claim independent third-party audits or a secondary human review team that does not exist today. Instead, Ebb relies on:

1. **Strict machine schemas**: Automated JSON Schema gates prevent malformed or unreferenced rules from entering the tree.
2. **Deterministic tests**: Over 1,400 automated unit, conformance, and property tests run on every pull request.
3. **Weekly automated source monitoring**: Continuous bots detect link rot and outdated evidence.
4. **Transparent provenance**: Every single rule links directly to its primary source so consumers can inspect and verify claims independently.
