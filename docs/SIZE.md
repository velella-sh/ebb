---
title: Bundle Size and Limits
description: Bundle size budgets and zero-dependency footprint of Ebb.
layout: doc
permalink: /size/
---

# Package Size and Budget

The npm package has no runtime dependencies. CI caps the packed tarball at **556,000 bytes**. The [Dated performance measurements](https://velella.sh/ebb/benchmarks/) page records the test environment and commands. [Infrastructure size decision](/decisions/infrastructure-size-budget/)

Consumers can import `@velella/ebb/data/<ecosystem>` to use a single ecosystem. Package tarball size and a downstream application’s bundle size are measured separately.

## How Size is Measured

Package size is measured automatically using `npm pack --dry-run --json` via:

:::terminal
$ npm run size
:::

The tool calculates:
1. Total packed tarball size.
2. Total unpacked size.
3. Top 10 largest files included in the package.
4. Gzipped size of the core registry data.

In CI, every pull request runs this check (`.github/workflows/size.yml`) and fails if the packed size exceeds the defined budget in `package.json`.

## Raising the Budget

The budget exists to prevent accidental packaging bloat (e.g. shipping build artifacts, tests, or unminified vendor files).

To raise the budget:
1. Open a discussion or decision record explaining why the size increase is necessary (e.g. addition of new ecosystem data rules).
2. Update `"sizeBudget"` in `package.json` under the `"ebb"` key.
3. Update this document and the size line in `README.md`.
