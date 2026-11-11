/**
 * Lightweight benchmark harness for Ebb performance measurements.
 * Reports min, median, p99, and max timings using process.hrtime.bigint().
 */

import { pathToFileURL } from "node:url";

export interface BenchmarkOptions {
  /** Number of warmup iterations (default: 5). */
  warmup?: number;
  /** Number of measured iterations (default: 100). */
  iterations?: number;
}

export interface BenchmarkStats {
  name: string;
  iterations: number;
  minMs: number;
  medianMs: number;
  p99Ms: number;
  maxMs: number;
  opsPerSec: number;
}

function percentile(sorted: readonly number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
}

/**
 * Runs a function `iterations` times after optional warmup, returning execution stats.
 */
export function runBenchmark(
  name: string,
  fn: () => unknown,
  options: BenchmarkOptions = {},
): BenchmarkStats {
  const warmup = options.warmup ?? 5;
  const iterations = options.iterations ?? 100;

  for (let i = 0; i < warmup; i += 1) {
    fn();
  }

  const durationsMs: number[] = new Array(iterations);
  for (let i = 0; i < iterations; i += 1) {
    const start = process.hrtime.bigint();
    fn();
    const end = process.hrtime.bigint();
    durationsMs[i] = Number(end - start) / 1_000_000;
  }

  const sorted = [...durationsMs].sort((a, b) => a - b);
  const minMs = Number((sorted[0] ?? 0).toFixed(4));
  const maxMs = Number((sorted[sorted.length - 1] ?? 0).toFixed(4));
  const medianMs = Number(percentile(sorted, 0.5).toFixed(4));
  const p99Ms = Number(percentile(sorted, 0.99).toFixed(4));
  const opsPerSec = medianMs > 0 ? Math.round(1000 / medianMs) : 0;

  return {
    name,
    iterations,
    minMs,
    medianMs,
    p99Ms,
    maxMs,
    opsPerSec,
  };
}

/**
 * Formats and prints benchmark results as a table.
 */
export function printBenchmarkTable(results: readonly BenchmarkStats[]): void {
  const tableData = results.map((r) => ({
    Benchmark: r.name,
    Iterations: r.iterations,
    "Min (ms)": r.minMs.toFixed(4),
    "Median (ms)": r.medianMs.toFixed(4),
    "P99 (ms)": r.p99Ms.toFixed(4),
    "Max (ms)": r.maxMs.toFixed(4),
    "Ops/sec": r.opsPerSec.toLocaleString(),
  }));
  console.table(tableData);
}

// When executed directly, run sample benchmark and display table
const isDirectExecution =
  process.argv[1] !== undefined &&
  (import.meta.url === pathToFileURL(process.argv[1]).href ||
    process.argv[1].endsWith("harness.ts") ||
    process.argv[1].endsWith("harness.js"));

if (isDirectExecution) {
  const sample = runBenchmark(
    "sample math.sqrt (1,000 iterations)",
    () => {
      let sum = 0;
      for (let i = 0; i < 1_000; i += 1) {
        sum += Math.sqrt(i);
      }
      return sum;
    },
    { warmup: 10, iterations: 100 },
  );

  printBenchmarkTable([sample]);
}
