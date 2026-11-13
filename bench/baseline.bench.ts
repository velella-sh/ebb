/**
 * Baseline performance benchmarks for Ebb.
 * Measures check, checkAll (1,000 items), and data load time.
 */

import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { BUNDLED_ECOSYSTEMS } from "../dist/src/data-bundle.js";
import { configureActiveData, getActiveDataSync } from "../dist/src/data-source.js";
import { check, checkAll } from "../dist/src/index.js";
import { validateRegistryV2 } from "../dist/src/registry.js";
import { type BenchmarkStats, printBenchmarkTable, runBenchmark } from "./harness.ts";

export function measureImportTime(): BenchmarkStats {
  return runBenchmark(
    "import (@velella/ebb)",
    () => {
      execSync("node --input-type=module -e 'import(\"./dist/src/index.js\")'", { stdio: "ignore" });
    },
    { warmup: 3, iterations: 10 },
  );
}

export function measureDataLoad(): BenchmarkStats {
  return runBenchmark(
    "data load (all bundled registries)",
    () => {
      configureActiveData({});
      const data = getActiveDataSync();
      for (const ecosystem of BUNDLED_ECOSYSTEMS) {
        validateRegistryV2(data.readSync(`registry/${ecosystem}.json`));
      }
    },
    { warmup: 3, iterations: 20 },
  );
}

export function measureCheck(): BenchmarkStats {
  // Warm up check so initial index creation does not skew steady-state measurement
  check("pkg:npm/left-pad", "1.3.0");

  return runBenchmark(
    "check (single item: pkg:npm/left-pad)",
    () => {
      check("pkg:npm/left-pad", "1.3.0");
    },
    { warmup: 50, iterations: 1000 },
  );
}

export function measureCheckAll(): BenchmarkStats {
  const sampleComponents = [
    { purl: "pkg:npm/left-pad", version: "1.3.0" },
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:npm/react", version: "18.2.0" },
    { purl: "pkg:golang/github.com/gin-gonic/gin", version: "1.9.0" },
    { purl: "pkg:pypi/requests", version: "2.28.0" },
    { purl: "pkg:cargo/rand", version: "0.8.5" },
    { purl: "pkg:composer/guzzlehttp/guzzle", version: "7.4.0" },
    { purl: "pkg:nuget/Newtonsoft.Json", version: "13.0.1" },
    { purl: "pkg:maven/org.apache.commons/commons-lang3", version: "3.12.0" },
    { purl: "pkg:gem/rails", version: "7.0.4" },
  ];

  const items1000 = Array.from(
    { length: 1000 },
    (_, i) => sampleComponents[i % sampleComponents.length]!,
  );

  // Warm up checkAll so initial index creation does not skew steady-state measurement
  checkAll(items1000);

  return runBenchmark(
    "checkAll (1,000 items)",
    () => {
      checkAll(items1000);
    },
    { warmup: 20, iterations: 100 },
  );
}

export function runBaseline(): BenchmarkStats[] {
  const importStats = measureImportTime();
  const loadStats = measureDataLoad();
  const checkStats = measureCheck();
  const checkAllStats = measureCheckAll();
  return [importStats, loadStats, checkStats, checkAllStats];
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  (import.meta.url === pathToFileURL(process.argv[1]).href ||
    process.argv[1].endsWith("baseline.bench.ts") ||
    process.argv[1].endsWith("baseline.bench.js"));

if (isDirectExecution) {
  const results = runBaseline();
  printBenchmarkTable(results);
}
