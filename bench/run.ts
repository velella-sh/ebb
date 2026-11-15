/**
 * Runner that executes all core benchmarks and outputs a JSON results file.
 */

import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { measureCheck, measureCheckAll, measureDataLoad, measureImportTime } from "./baseline.bench.ts";
import { profileCheck1000 } from "./check.bench.ts";
import { type BenchmarkStats, printBenchmarkTable } from "./harness.ts";

export interface BenchmarkSuiteResult {
  timestamp: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  results: Record<string, BenchmarkStats>;
}

export function runAllBenchmarks(outputPath = "bench-results.json"): BenchmarkSuiteResult {
  console.log("Running Ebb benchmarks...\n");

  const results: Record<string, BenchmarkStats> = {};

  console.log("0. Benchmarking import time...");
  const importStats = measureImportTime();
  results[importStats.name] = importStats;

  console.log("1. Benchmarking data load...");
  const dataLoadStats = measureDataLoad();
  results[dataLoadStats.name] = dataLoadStats;

  console.log("2. Benchmarking check (single lookup)...");
  const checkStats = measureCheck();
  results[checkStats.name] = checkStats;

  console.log("3. Benchmarking checkAll (1,000 items)...");
  const checkAllStats = measureCheckAll();
  results[checkAllStats.name] = checkAllStats;

  console.log("4. Benchmarking per-component check latency (1,000 items)...");
  const checkLatencyStats = profileCheck1000();
  results[checkLatencyStats.name] = checkLatencyStats;

  console.log("\nAll Benchmark Results:");
  printBenchmarkTable(Object.values(results));

  const suiteResult: BenchmarkSuiteResult = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    results,
  };

  writeFileSync(outputPath, `${JSON.stringify(suiteResult, null, 2)}\n`, "utf8");
  console.log(`\nBenchmark results written to ${outputPath}`);

  return suiteResult;
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  runAllBenchmarks();
}
