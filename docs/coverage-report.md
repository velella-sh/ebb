---
title: Data coverage report
description: Weekly coverage counts for the signed Ebb dataset, with evidence, archive and review status by ecosystem.
layout: doc
permalink: /coverage-report/
---

See the [coverage gaps](https://velella.sh/ebb/gaps/) for evidence-backed work and the [coverage card](https://velella.sh/ebb/assets/coverage-card.svg) for the same headline counts.

<!-- coverage:begin -->

Week of 2026-11-23 · Reference date 2026-11-28 UTC · [Signed data 2026.11.11](https://github.com/velella-sh/ebb/releases/tag/data-v2026.11.11)

**782 rules · 416 components · 733 recorded gaps**

Evidence comprises 455 unique primary URLs. Archived evidence was recorded for 352 of them. 782 rules have a dated review at this reference date.

- runtime-line: 21
- text-successor: 712
- stale-rule: 0
- dead-source: 0
- requested-product: 0

Source lock SHA-256 `8b604d113895b6ec122eeea01be25500c983a303a6b1bcc0c89308fcb6f38b1c`. [Coverage inputs at this checkout](https://github.com/velella-sh/ebb/tree/866944fb596b08882ade3904cb1c0957c3b0443c/tools/coverage/expected).

## Ecosystems

| Ecosystem | Components | Rules | Events | Future dated | Confidence | Median review days (dated rules) | Source statuses | Archived URLs / primary URLs |
| --- | ---: | ---: | --- | ---: | --- | --- | --- | ---: |
| android | 2 | 6 | deprecated 3, end-of-support 1, scheduled-end-of-life 2 | 2 | likely 6 | 40 (6) | ok 2 | 2 / 2 |
| ci-images | 3 | 5 | removed 3, scheduled-end-of-life 2 | 1 | likely 5 | 38 (5) | ok 3 | 3 / 3 |
| container | 27 | 35 | deprecated 2, end-of-life 27, scheduled-end-of-life 6 | 5 | likely 35 | 33 (35) | ok 31, unknown 3 | 31 / 34 |
| cpp | 4 | 5 | deprecated 3, removed 2 | 0 | likely 5 | 40 (5) | ok 8 | 8 / 8 |
| dart | 2 | 15 | deprecated 1, end-of-support 14 | 0 | likely 15 | 21 (15) | ok 5 | 5 / 5 |
| database | 13 | 48 | end-of-life 25, end-of-support 19, scheduled-end-of-life 4 | 3 | likely 48 | 29 (48) | ok 17, unknown 3 | 17 / 20 |
| deno | 2 | 4 | end-of-life 4 | 0 | likely 4 | 33 (4) | ok 4 | 4 / 4 |
| dotnet | 5 | 16 | deprecated 4, end-of-support 12 | 0 | likely 16 | 40 (16) | ok 8 | 8 / 8 |
| elixir | 3 | 5 | deprecated 1, end-of-life 4 | 0 | likely 5 | 33 (5) | ok 8 | 8 / 8 |
| github-actions | 29 | 29 | deprecated 2, end-of-support 23, removed 4 | 0 | likely 29 | 43 (29) | ok 27 | 27 / 27 |
| go | 7 | 12 | deprecated 6, end-of-support 6 | 0 | likely 12 | 40.5 (12) | ok 8 | 8 / 8 |
| java | 5 | 11 | deprecated 3, end-of-support 8 | 0 | likely 11 | 42 (11) | ok 9 | 9 / 9 |
| kubernetes | 48 | 80 | end-of-life 16, end-of-support 8, removed 50, scheduled-end-of-life 6 | 6 | likely 80 | 39 (80) | ok 15 | 15 / 15 |
| nodejs | 1 | 80 | deprecated 25, end-of-life 7, removed 47, scheduled-end-of-life 1 | 1 | likely 80 | 38 (80) | ok 3 | 3 / 3 |
| npm | 74 | 82 | deprecated 63, end-of-life 9, end-of-support 7, scheduled-end-of-life 3 | 2 | likely 82 | 43 (82) | ok 89, unknown 68 | 89 / 157 |
| osv | 2 | 2 | deprecated 2 | 0 | likely 2 | 32 (2) | ok 4 | 4 / 4 |
| php | 7 | 14 | deprecated 5, end-of-life 7, end-of-support 2 | 0 | likely 14 | 39 (14) | ok 17 | 17 / 17 |
| python | 41 | 129 | deprecated 40, end-of-life 38, removed 51 | 0 | likely 129 | 38 (129) | ok 63, unknown 17 | 63 / 80 |
| ruby | 3 | 15 | end-of-life 13, removed 1, scheduled-end-of-life 1 | 0 | likely 15 | 39 (15) | ok 5 | 5 / 5 |
| rust | 5 | 5 | deprecated 4, end-of-support 1 | 0 | likely 5 | 42 (5) | ok 6 | 6 / 6 |
| scala | 2 | 3 | end-of-life 2, end-of-support 1 | 0 | likely 3 | 32 (3) | ok 5 | 5 / 5 |
| serverless | 127 | 138 | deprecated 3, end-of-life 71, end-of-support 41, scheduled-end-of-life 23 | 23 | likely 138 | 29 (138) | ok 10 | 10 / 10 |
| shell | 1 | 7 | end-of-life 7 | 0 | likely 7 | 37 (7) | ok 1 | 1 / 1 |
| swift | 2 | 3 | end-of-support 3 | 0 | likely 3 | 40 (3) | ok 3 | 3 / 3 |
| terraform | 4 | 33 | deprecated 1, end-of-life 7, end-of-support 24, removed 1 | 0 | likely 33 | 33 (33) | ok 17, unknown 12 | 17 / 29 |

## Recorded weekly trend

| Week (UTC) | Data version | Rules | Components | Recorded gaps | Product requests |
| --- | --- | ---: | ---: | ---: | --- |
| 2026-11-23 | 2026.11.11 | 782 | 416 | 733 | Included |

<!-- coverage:end -->

## What the report counts

| Measure | Denominator and source |
| --- | --- |
| Components | Distinct Package URL identities in the signed snapshot, ignoring versions and normalizing with Ebb's matcher. The global count deduplicates identities across ecosystems. |
| Rules and events | Signed rule rows. Each rule contributes to one ecosystem and one event. |
| Future-dated rules | Signed rules whose recorded deadline is later than the reference day. A month-precision rule uses the stored end-of-month date for this total. |
| Confidence | Signed rule confidence or Ebb's existing evidence and precision calculation when the field is absent. |
| Median review age | Whole UTC days since each rule's reviewed date. The reported denominator includes only recorded reviews no later than the reference day. A median of two middle values can end in half a day. |
| Source status | Distinct primary evidence URLs within the scope, joined to the checked-in source lock at the build commit. Observations dated later than the reference date and locations without a dated entry are unknown. A URL can occur in several ecosystems. |
| Archive coverage | Unique primary URLs with a recorded archive beside the signed rule or in an eligible source-lock entry, divided by unique primary URLs. This measures recorded archive coverage. |

The signed release provides the rules and review windows. The source lock and [expected runtime inventories](https://github.com/velella-sh/ebb/tree/main/tools/coverage/expected) are separate, revisioned inputs. A build uses an explicit UTC reference date for deadlines, review ages and evidence observations. The report reads local files without network access. Its workflow retrieves the signed artifacts and any available GitHub inputs before invoking it.

## What counts as a gap

- **Runtime release line** uses the official schedules and reviewed [expected inventory](https://velella.sh/ebb/coverage/), and the existing rule-range check. A runtime with no dated schedule has a documented limit.
- **Text-only successor** means a signed rule has non-empty text in `replacement` and no structured entries in `replacements`. The audit's classifications are suggestions for review.
- **Stale rule** has exceeded the signed registry's review window. The registry default is 365 days.
- **Dead source** is a unique primary URL with an eligible source-lock status of unreachable or archive-only. Missing observations remain unknown.
- **Requested product** is an open GitHub `new-product` issue whose canonical PURL is absent from the signed snapshot. Requests with an indeterminate PURL are counted separately when the issue queue can be read.

The recorded gap total sums these categories. One component can appear in multiple categories. Archived history uses a UTC Monday week key and keeps the first captured entry for each week. The [weekly workflow](https://github.com/velella-sh/ebb/actions/workflows/coverage-report.yml) runs on Thursdays, using the data version pinned by Pages. It archives the report, gap list and SVG for download. A dispatch with an explicit date creates a preview. Pages carries forward the archived history during its regular deploys.
