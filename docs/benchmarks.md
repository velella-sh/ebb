---
title: Benchmarks and evidence
description: Reproduce Ebb's measured Node.js timings, package size and agent-scoring fixtures.
layout: doc
permalink: /benchmarks/
---

The [Benchmark workflow](https://github.com/velella-sh/ebb/actions/workflows/bench.yml) uploads `bench-results.json` for each successful run. It records the Node version, platform, runner label, commit, command, and raw timing summaries. Pull requests compare against the last successful main run. MCP process startup has its own median limit in the same job.

## Recorded CI measurement

[28 November 2026, main commit `e199df7`](https://github.com/velella-sh/ebb/actions/runs/46109190211) ran on GitHub Actions `ubuntu-latest` (Linux x64) using Node v22.23.5. The numbers are specific to that checkout, runner and workload.

| Measurement | Iterations | Median (ms) | P99 (ms) |
| --- | ---: | ---: | ---: |
| Package import in a fresh process | 10 | 49.9074 | 52.0810 |
| Load all bundled registries | 20 | 23.4279 | 37.6442 |
| Warm `check` lookup for one npm package | 1,000 | 0.0091 | 0.0210 |
| Warm `checkAll` batch of 1,000 entries | 100 | 0.1374 | 0.3397 |
| Single-component latency across 1,000 entries | 1,000 | 0.0079 | 0.1492 |

The same job recorded a **78.74 ms** median for starting the MCP process and completing `initialize`. The raw core timings are in the [JSON artifact](https://github.com/velella-sh/ebb/actions/runs/46109190211/artifacts/15248394420) and the MCP median is in the run log. The older [local baselines](https://github.com/velella-sh/ebb/blob/main/bench/BASELINE.md) describe their own environments.

From a checkout of the recorded commit, use Node v22.23.5 and run:

```bash
npm ci
npm run bench
npm run size
```

`npm run bench` writes `bench-results.json` and prints the MCP check. `npm run size` measures the packaged artifacts and checks the byte budgets. The separate [agent scoring fixtures](https://velella.sh/ebb/agent-evals/) are reproduced with `npm run eval:agents`.

## Evidence for published claims

| Claim | Evidence or disposition |
| --- | --- |
| Node startup and warm query timings | Use the measured CI cases above. The prior universal sub-20 ms startup claim has been removed. |
| Bun and browser/edge behavior | Runtime compatibility tests establish behavior. Fixed timing and browser/edge bundle-size claims without a retained, revisioned measurement have been removed. Measure deployment bundles with the application's own build. |
| Packed npm footprint, static index size | Use `npm run size` and the [package size page](https://velella.sh/ebb/size/). The README no longer asserts a fixed package size. |
| Agent accuracy or deprecation-rate reduction | The [matrix](https://velella.sh/ebb/agent-evals/) labels each simulated result. The numerical quickstart claim has been removed pending published live comparisons. |
| xeol migration duration | The [migration guide](https://velella.sh/ebb/from-xeol/) describes the workflow. The prior timing claim has been removed pending a versioned replay. |
| VERS parser conformance | The [documented conformance cases](https://velella.sh/ebb/vers/) and CI tests measure compatibility with the pinned corpus. |
