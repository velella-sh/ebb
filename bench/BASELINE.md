# Baseline Performance Measurements

Initial baseline numbers captured prior to performance optimizations in milestone `v0.2.0` (Issue #253).

## Environment

- **OS:** macOS 27.2.1 (Darwin arm64)
- **CPU:** Apple M5 (10 cores)
- **Memory:** 16.0 GB RAM
- **Node.js:** v26.13.0
- **Ebb Version:** 0.1.1

## Baseline Results

Measured with `bench/baseline.bench.ts` using high-resolution timers (`process.hrtime.bigint()`):

| Metric | Target | Iterations | Min (ms) | Median (ms) | P99 (ms) | Ops/sec |
|---|---|---|---|---|---|---|
| **Data Load** | All 25 bundled registries | 20 | 10.3287 | **11.0472** | 14.0036 | 91 |
| **`check`** | Single component (`pkg:npm/left-pad@1.3.0`) | 1,000 | 0.0015 | **0.0018** | 0.0060 | 555,556 |
| **`checkAll`** | 1,000 components batch | 50 | 0.0480 | **0.0519** | 0.2043 | 19,268 |

## Observations

1. **Data Load:** Loading and validating all 25 bundled registry files takes ~11.0 ms median cold time.
2. **`check` (single lookup):** Single lookup in steady state takes ~0.0018 ms median.
3. **`checkAll` (1,000 items):** Evaluating a batch of 1,000 components takes ~0.0519 ms median.
