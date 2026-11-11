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

## Cold Start Measurements (Node 22 vs Node 24)

Measured with `bench/cold-start.bench.ts` in fresh, isolated processes (10 iterations each) on Apple M5 (macOS 27.2.1):

| Runtime | Metric | Iterations | Min (ms) | Median (ms) | P99 (ms) | Ops/sec |
|---|---|---|---|---|---|---|
| **Node 22** (`v22.23.4`) | Module import (`@velella/ebb`) | 10 | 46.9503 | **54.8284** | 65.7893 | 18 |
| **Node 22** (`v22.23.4`) | First `check()` (cold data load + check) | 10 | 61.3451 | **65.0775** | 85.0924 | 15 |
| **Node 22** (`v22.23.4`) | Total cold start (import + check) | 10 | 110.9506 | **122.1665** | 150.8817 | 8 |
| **Node 24** (`v24.22.2`) | Module import (`@velella/ebb`) | 10 | 22.3752 | **30.5765** | 41.6885 | 33 |
| **Node 24** (`v24.22.2`) | First `check()` (cold data load + check) | 10 | 37.7033 | **55.3458** | 66.1266 | 18 |
| **Node 24** (`v24.22.2`) | Total cold start (import + check) | 10 | 60.0785 | **88.0810** | 100.3099 | 11 |

### Cold Start Takeaways

- Node 24 reduces pure ESM import overhead by ~44% (30.6 ms vs 54.8 ms median) compared to Node 22.
- Total cold start time (from fresh process spawn to first completed lifecycle check) is ~88.1 ms on Node 24 and ~122.2 ms on Node 22.
- Once loaded, steady-state lookups operate under sub-millisecond times (~0.0018 ms).

