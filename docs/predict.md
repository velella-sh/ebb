---
title: End-of-life predictions
description: Estimate end-of-life ranges from vendor policy and release history.
---

Ebb publishes optional planning estimates for some release lines without an announced end. Read the date range and confidence together. Your lifecycle result, migration recommendation, and automation exit code still come from the registry rules.

```bash
ebb versions pkg:generic/golang
ebb versions pkg:generic/golang --json
```

Use `predictEol(purl, version)` or `predictions(purl)` from `@velella/ebb/predict`. The MCP tool is `predict_eol`. The [static prediction table](https://velella.sh/ebb/api/v1/predictions.json) includes the same [evidence and range fields](formats/prediction.v1.md). The CLI's `predicted` array is available from the snapshot date onward and sits alongside the existing release lines.

## Methods

- **Policy.** Apply the vendor's support rule to the expected successor release. Allow seven days around a tentative date or month. Without a schedule, project the median of up to six known recent release intervals and widen the observed range by two weeks per projected successor. Go retires a release after two newer major releases. Oracle's rule applies to non-LTS Java. Rust supports the current stable release and follows a six-week release train. [Go release policy](https://go.dev/doc/devel/release), [Java support roadmap](https://www.oracle.com/java/technologies/java-se-support-roadmap.html), [Rust maintenance policy](https://doc.rust-lang.org/book/appendix-07-nightly-rust.html#maintenance-time).
- **Cadence.** Add the median lifetime of at least three ended release lines to the new line's first release and use the shortest and longest observed lifetime for the range. Ruby's published branch list records past dates and current support phases. It gives no fixed duration for the current open branches. [Ruby maintenance branches](https://www.ruby-lang.org/en/downloads/branches/).

The Go draft release notes and Rust release train supply tentative successor dates. The Rust release announcements supply dated release history for individual Rust lines. The primary coverage snapshot still groups its older lines. [Go 1.28 draft](https://github.com/golang/go/blob/master/doc/next/1-intro.md), [Rust release train](https://forge.rust-lang.org/), [Rust releases](https://blog.rust-lang.org/releases/).

## Historical replay

For each ended line with an observed end, replay at its first release. Hide the line's end, future releases, and earlier lines' ends that had yet to occur. Exclude present-day tentative schedules. For a month-only outcome, measure error as distance to the month and count a range hit if it overlaps the month. Cadence scores include comparator results for products that use official policies in production.

<!-- backtest:begin -->
| Product | Method | Scored lines | Median absolute error (days) | Range hit rate |
| --- | --- | ---: | ---: | ---: |
| `pkg:generic/bun` | policy | 0 | — | — |
| `pkg:generic/bun` | cadence | 0 | — | — |
| `pkg:generic/deno` | policy | 0 | — | — |
| `pkg:generic/deno` | cadence | 0 | — | — |
| `pkg:generic/dotnet` | policy | 0 | — | — |
| `pkg:generic/dotnet` | cadence | 7 | 153 | 71.4% |
| `pkg:generic/golang` | policy | 6 | 5.5 | 100.0% |
| `pkg:generic/golang` | cadence | 2 | 4 | 0.0% |
| `pkg:generic/helm` | policy | 0 | — | — |
| `pkg:generic/helm` | cadence | 0 | — | — |
| `pkg:generic/linux-cip` | policy | 0 | — | — |
| `pkg:generic/linux-cip` | cadence | 0 | — | — |
| `pkg:generic/odoo-enterprise` | policy | 0 | — | — |
| `pkg:generic/odoo-enterprise` | cadence | 0 | — | — |
| `pkg:generic/linux` | policy | 0 | — | — |
| `pkg:generic/linux` | cadence | 0 | — | — |
| `pkg:generic/java` | policy | 8 | 0 | 100.0% |
| `pkg:generic/java` | cadence | 4 | 0 | 100.0% |
| `pkg:generic/nodejs` | policy | 0 | — | — |
| `pkg:generic/nodejs` | cadence | 7 | 1 | 71.4% |
| `pkg:generic/php` | policy | 0 | — | — |
| `pkg:generic/php` | cadence | 0 | — | — |
| `pkg:generic/python` | policy | 0 | — | — |
| `pkg:generic/python` | cadence | 0 | — | — |
| `pkg:generic/ruby` | policy | 0 | — | — |
| `pkg:generic/ruby` | cadence | 0 | — | — |
| `pkg:generic/rust` | policy | 6 | 0 | 100.0% |
| `pkg:generic/rust` | cadence | 3 | 0 | 100.0% |
<!-- backtest:end -->

High confidence requires at least eight scored lines and a 90% range hit rate. Medium requires at least four and a 75% hit rate. Otherwise the confidence is low. These labels describe historical coverage. The table is a retrospective reconstruction from official histories, whose past public availability can differ from the event calendar. In particular, Ruby has enough ended lines to estimate today and too few completed before the historical release cutoffs to score this snapshot.

```bash
npm run build
node dist/tools/predict/history.js
node dist/tools/predict/backtest.js
node dist/tools/predict/generate.js
```

The generator skips already ended or unreleased lines, known official dates, and lines covered by authoritative dated rules. It declines to extrapolate feature-release lifetimes to Java LTS lines.
