---
title: "Confidence levels"
description: "How Ebb classifies rule confidence into confirmed, likely, and tentative tiers, reviewer criteria, and live coverage counts."
layout: doc
permalink: /confidence/
---

# Confidence levels

Every answer in Ebb says how far it can be trusted. Rather than arbitrary decimal percentages that imply false precision, Ebb uses three qualitative confidence tiers: `confirmed`, `likely`, and `tentative`.

Every match returned by `check()`, displayed by the CLI, answered by the MCP server, and published in the static API carries its confidence level.

---

## The three levels

1. **`confirmed`**
   Published directly by the primary vendor or upstream maintainers with an explicit, stated date or lifecycle policy, and verified by an Ebb maintainer (`provenance.reviewedAt`).

2. **`likely`**
   Sourced from official vendor schedules, standard release cadences, or automated platform importers without individual hand-review of every date, or where dates follow strict upstream cycle rules.

3. **`tentative`**
   Dates or migration paths that are community-estimated, inferred from ambiguous statements, or where the upstream vendor documentation is incomplete or contradictory. A `tentative` rule always requires a written `confidenceNote` explaining why, and automated tools advise verifying before taking action. Tentative is never derived automatically; it must be written by hand.

---

## Reviewer test: How to classify a rule

When writing or reviewing a rule, two criteria determine the confidence level:

1. **Who published the date?**
   - *Primary vendor / upstream project*: The official team managing the software (e.g. Node.js Technical Steering Committee, Python Foundation, Microsoft, HashiCorp).
   - *Secondary tracker or aggregator*: A third-party database or community tracker (e.g. endoflife.date, Repology, Wikipedia).

2. **Is the date stated or inferred?**
   - *Stated*: The publisher explicitly names the calendar day or month in an official schedule or deprecation notice.
   - *Inferred*: The date is calculated from a release cadence formula (e.g. "supported for 18 months following general availability"), or estimated based on precedent.

### Decision matrix

| Publisher | Date nature | Review status | Confidence level | `confidenceNote` required? |
|---|---|---|---|---|
| Primary upstream | Stated | Reviewed by maintainer | `confirmed` | Optional |
| Primary upstream | Stated | Importer only (no review date) | `likely` | Optional |
| Primary upstream | Inferred from cadence | Any | `likely` | Optional |
| Secondary tracker | Stated or inferred | Any | `likely` | Optional |
| Any | Incomplete or contradictory | Any | `tentative` | **Yes** (enforced by linter) |

---

## Real-world examples

### 1. `confirmed`: Node.js 20 Active LTS (`nodejs.runtime.eol-20`)

The Node.js Release Working Group publishes an explicit schedule table with the exact end-of-life date (`2026-04-30`). The rule cites the official upstream repository and was reviewed by an Ebb maintainer.

- **Publisher**: Primary upstream (Node.js Release Team)
- **Date nature**: Stated explicitly
- **Level**: `confirmed`

### 2. `likely`: .NET 7.0 End of Support (`dotnet.sdk.end-of-support-7.0`)

Generated from the official Microsoft .NET support policy via the `dotnet-1` importer. The policy establishes STS (Standard Term Support) duration, but individual patch branches are tracked via automated ingestion.

- **Publisher**: Primary upstream (Microsoft)
- **Date nature**: Derived from standard cadence / importer
- **Level**: `likely`

### 3. `tentative`: Redis 5.0 End of Life (`database.redis.end-of-life-5.0`)

While Redis marks 5.0 as end-of-life, the documentation does not publish a verified, supported upgrade path from 5.0 to distant versions (7.x+). The rule requires manual data rehearsal and carries an explicit note.

- **Publisher**: Primary upstream, but upgrade path documentation is incomplete
- **Date nature**: Stated EOL, but incomplete migration guidance
- **Level**: `tentative`
- **`confidenceNote`**: *"The Redis documentation reviewed does not publish a supported upgrade path for jumping from 5.0 to a distant release; rehearsal on copied data is required."*

---

## Live rule counts

Live counts of registered rules across the three confidence levels are compiled at build time by `npm run badges`:

<!-- ebb-confidence-counts:start -->
| Level | Count | Description |
|---|---|---|
| `confirmed` | 663 | Published directly by upstream with a stated date and reviewed by a maintainer |
| `likely` | 168 | Sourced from official schedules/importers or inferred from release cadences |
| `tentative` | 2 | Inferred, incomplete source, or non-binding; verified note required |
<!-- ebb-confidence-counts:end -->
